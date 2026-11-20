import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApplication } from '../infrastructure/create-application';
import { STORAGE_KEYS } from '../infrastructure/repositories/local-data';

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  failKey: string | null = null;
  failureCount = 0;
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    if (key === this.failKey && this.failureCount > 0) {
      this.failureCount -= 1;
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    }
    this.items.set(key, value);
  }
  snapshot() {
    return JSON.stringify([...this.items.entries()]);
  }
}

const START = 1_800_000 * 100;
const command = {
  resourceId: 'room-1',
  startAt: START,
  endAt: START + 1_800_000,
};

describe('browser application boundary', () => {
  let local: MemoryStorage;
  let session: MemoryStorage;
  beforeEach(() => {
    local = new MemoryStorage();
    session = new MemoryStorage();
  });

  it('normalizes email, reuses identity and restores a session after reload', async () => {
    const app = createApplication(local, session, () => 0);
    const first = await app.login('  Alex@Example.com ');
    expect(first).toMatchObject({
      ok: true,
      value: { email: 'alex@example.com' },
    });
    await app.logout();
    const second = await app.login('alex@example.com');
    expect(second).toEqual(first);
    expect(await createApplication(local, session).getCurrentUser()).toEqual(
      first,
    );
    expect(
      JSON.parse(session.getItem(STORAGE_KEYS.session) ?? '{}').session,
    ).toEqual(first.ok ? { userId: first.value.userId } : null);
  });

  it('enforces session, validation order, application grid and future start', async () => {
    const app = createApplication(local, session, () => 1);
    expect(await app.createBooking({})).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    });
    await app.login('a@example.com');
    expect(
      await app.createBooking({
        resourceId: 'missing',
        startAt: NaN,
        endAt: 0,
      }),
    ).toMatchObject({ error: { code: 'INVALID_INPUT' } });
    expect(
      await app.createBooking({ resourceId: 'missing', startAt: 2, endAt: 1 }),
    ).toMatchObject({ error: { code: 'RESOURCE_NOT_FOUND' } });
    expect(await app.createBooking({ ...command, endAt: START })).toMatchObject(
      { error: { code: 'INVALID_INTERVAL' } },
    );
    expect(
      await app.createBooking({ ...command, startAt: START + 1 }),
    ).toMatchObject({ error: { code: 'OFF_GRID_TIME' } });
    expect(await app.createBooking({ ...command, startAt: 0 })).toMatchObject({
      error: { code: 'START_IN_PAST' },
    });
  });

  it('preserves IDs through rejections, cancellation and reload, and keeps queries byte-for-byte read-only', async () => {
    const app = createApplication(local, session, () => 0);
    await app.login('a@example.com');
    expect(await app.createBooking(command)).toMatchObject({
      ok: true,
      value: { id: 1 },
    });
    expect(await app.createBooking(command)).toMatchObject({
      error: { code: 'TIME_SLOT_CONFLICT' },
    });
    const before = local.snapshot();
    expect(
      await app.checkAvailability(
        command.resourceId,
        command.startAt,
        command.endAt,
      ),
    ).toMatchObject({
      ok: true,
      value: { isAvailable: false, conflicts: [{ id: 1 }] },
    });
    expect(local.snapshot()).toBe(before);
    expect(await app.cancelBooking(1)).toMatchObject({
      ok: true,
      value: { outcome: 'cancelled' },
    });
    const cancelledState = local.snapshot();
    expect(await app.cancelBooking(1)).toMatchObject({
      ok: true,
      value: { outcome: 'already_cancelled' },
    });
    expect(local.snapshot()).toBe(cancelledState);
    expect(
      await createApplication(local, session, () => 0).createBooking(command),
    ).toMatchObject({ ok: true, value: { id: 2 } });
  });

  it('rejects direct non-owner cancellation before inspecting status', async () => {
    const app = createApplication(local, session, () => 0);
    await app.login('a@example.com');
    await app.createBooking(command);
    await app.login('b@example.com');
    const before = local.snapshot();
    expect(await app.cancelBooking(1)).toMatchObject({
      error: { code: 'NOT_BOOKING_OWNER' },
    });
    expect(local.snapshot()).toBe(before);
    await app.login('a@example.com');
    await app.cancelBooking(1);
    await app.login('b@example.com');
    expect(await app.cancelBooking(1)).toMatchObject({
      error: { code: 'NOT_BOOKING_OWNER' },
    });
  });

  it('rolls back the bookings write if the sequence write exceeds quota', async () => {
    const app = createApplication(local, session, () => 0);
    await app.login('a@example.com');
    await app.createBooking(command);
    const before = local.snapshot();
    local.failKey = STORAGE_KEYS.sequence;
    local.failureCount = 1;
    expect(
      await app.createBooking({ ...command, resourceId: 'room-2' }),
    ).toMatchObject({ error: { code: 'STORAGE_QUOTA_EXCEEDED' } });
    expect(local.snapshot()).toBe(before);
    expect(
      await app.createBooking({ ...command, resourceId: 'room-2' }),
    ).toMatchObject({ ok: true, value: { id: 2 } });
  });

  it('removes an uncommitted first booking when the initial sequence write fails', async () => {
    const app = createApplication(local, session, () => 0);
    await app.login('a@example.com');
    local.failKey = STORAGE_KEYS.sequence;
    local.failureCount = 1;
    const notify = vi.fn();
    app.subscribe(notify);
    expect(await app.createBooking(command)).toMatchObject({
      error: { code: 'STORAGE_QUOTA_EXCEEDED' },
    });
    expect(local.getItem(STORAGE_KEYS.bookings)).toBeNull();
    expect(local.getItem(STORAGE_KEYS.sequence)).toBeNull();
    expect(notify).not.toHaveBeenCalled();
    expect(await app.createBooking(command)).toMatchObject({
      value: { id: 1 },
    });
    expect(notify).toHaveBeenCalledOnce();
  });

  it('keeps availability read-only even when the sequence key is missing', async () => {
    const app = createApplication(local, session, () => 0);
    await app.login('a@example.com');
    await app.createBooking(command);
    local.removeItem(STORAGE_KEYS.sequence);
    const before = local.snapshot();
    expect(
      await app.checkAvailability(
        command.resourceId,
        command.startAt,
        command.endAt,
      ),
    ).toMatchObject({ ok: true });
    expect(local.snapshot()).toBe(before);
  });

  it('re-reads current bookings before commands and rejects broken ownership references', async () => {
    const first = createApplication(local, session, () => 0);
    await first.login('a@example.com');
    const second = createApplication(local, session, () => 0);
    await first.createBooking(command);
    expect(await second.createBooking(command)).toMatchObject({
      error: { code: 'TIME_SLOT_CONFLICT' },
    });
    local.setItem(
      STORAGE_KEYS.users,
      JSON.stringify({ schemaVersion: 1, items: [] }),
    );
    expect(await second.initialize()).toMatchObject({
      error: {
        code: 'STORAGE_CORRUPTED',
        details: { key: STORAGE_KEYS.bookings },
      },
    });
  });

  it.each([
    'null',
    '{"schemaVersion":2,"items":[]}',
    '{"schemaVersion":1,"items":null}',
  ])('preserves invalid stored envelopes during startup: %s', async (raw) => {
    local.setItem(STORAGE_KEYS.users, raw);
    const app = createApplication(local, session);
    expect(await app.initialize()).toMatchObject({
      error: { code: 'STORAGE_CORRUPTED' },
    });
    expect(local.getItem(STORAGE_KEYS.users)).toBe(raw);
  });

  it('rejects duplicate booking IDs instead of deriving a new sequence', async () => {
    const app = createApplication(local, session, () => 0);
    await app.login('a@example.com');
    await app.createBooking(command);
    const stored: unknown = JSON.parse(
      local.getItem(STORAGE_KEYS.bookings) ?? '{}',
    );
    if (
      typeof stored !== 'object' ||
      stored === null ||
      !('items' in stored) ||
      !Array.isArray(stored.items)
    )
      throw new Error('Missing test booking');
    local.setItem(
      STORAGE_KEYS.bookings,
      JSON.stringify({
        schemaVersion: 1,
        items: [...stored.items, ...stored.items],
      }),
    );
    expect(await app.initialize()).toMatchObject({
      error: { code: 'STORAGE_CORRUPTED' },
    });
  });

  it('reports session write failure; retry reuses the already persisted identity', async () => {
    const app = createApplication(local, session, () => 0);
    session.failKey = STORAGE_KEYS.session;
    session.failureCount = 1;
    expect(await app.login('a@example.com')).toMatchObject({
      error: { code: 'STORAGE_QUOTA_EXCEEDED' },
    });
    expect(await app.getCurrentUser()).toEqual({ ok: true, value: null });
    const savedUsers = local.getItem(STORAGE_KEYS.users);
    expect(await app.login('a@example.com')).toMatchObject({ ok: true });
    expect(local.getItem(STORAGE_KEYS.users)).toBe(savedUsers);
  });

  it('reports corrupt JSON and refuses reset without typed confirmation', async () => {
    local.setItem(STORAGE_KEYS.bookings, '{broken');
    const app = createApplication(local, session);
    expect(await app.initialize()).toMatchObject({
      error: { code: 'STORAGE_CORRUPTED' },
    });
    expect(await app.exportRawData()).toMatchObject({ ok: true });
    expect(await app.resetLocalData('reset')).toMatchObject({
      error: { code: 'INVALID_INPUT' },
    });
    expect(local.getItem(STORAGE_KEYS.bookings)).toBe('{broken');
    expect(await app.resetLocalData('RESET')).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await app.initialize()).toMatchObject({
      ok: true,
      value: { user: null },
    });
  });

  it('detects a regressed sequence and recovers a missing sequence with warning', async () => {
    const app = createApplication(local, session, () => 0);
    await app.login('a@example.com');
    await app.createBooking(command);
    local.setItem(
      STORAGE_KEYS.sequence,
      JSON.stringify({ schemaVersion: 1, lastIssuedId: 0 }),
    );
    expect(await app.initialize()).toMatchObject({
      error: { code: 'STORAGE_CORRUPTED' },
    });
    local.removeItem(STORAGE_KEYS.sequence);
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    expect(await app.initialize()).toMatchObject({ ok: true });
    expect(warning).toHaveBeenCalledOnce();
    expect(
      JSON.parse(local.getItem(STORAGE_KEYS.sequence) ?? '{}').lastIssuedId,
    ).toBe(1);
    warning.mockRestore();
  });

  it('discards a dangling identity and reports blocked storage without clearing data', async () => {
    const app = createApplication(local, session, () => 0);
    await app.login('a@example.com');
    local.removeItem(STORAGE_KEYS.users);
    expect(await app.initialize()).toEqual({
      ok: true,
      value: { user: null, sessionReset: true },
    });
    expect(session.getItem(STORAGE_KEYS.session)).toBeNull();
    vi.spyOn(local, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(await app.initialize()).toMatchObject({
      error: { code: 'STORAGE_UNAVAILABLE' },
    });
  });
});
