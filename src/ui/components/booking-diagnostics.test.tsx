import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MouseEvent } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { createApplication } from '../../infrastructure/create-application';
import { useApplication } from '../hooks/use-application';
import { BookingDialog } from './booking-dialog';
import { nextSlot, SLOT_MS } from '../lib/time';

vi.mock('../hooks/use-application', () => ({ useApplication: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('copies the reference for an unexpected booking operation and retains a sanitized diagnostic cause', async () => {
  localStorage.clear();
  sessionStorage.clear();
  const interaction = userEvent.setup();
  const clipboard = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue();
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  let fail = false;
  const app = createApplication(localStorage, sessionStorage, () => {
    if (fail) throw new TypeError('owner@example.com {"startAt":123}');
    return Date.now();
  });
  const login = await app.login('owner@example.com');
  if (!login.ok) throw new Error('Expected login');
  vi.mocked(useApplication).mockReturnValue({
    app,
    user: login.value,
    users: [login.value],
    bookings: [],
    loading: false,
    readOnly: false,
    revision: 0,
    error: null,
    refresh: vi.fn(async () => {}),
  });
  const startAt = nextSlot(Date.now() + 86400000);
  render(
    <BookingDialog
      selection={{ resourceId: 'room-1', startAt, endAt: startAt + SLOT_MS }}
      onClose={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Book' })).toBeEnabled(),
  );
  fail = true;
  await interaction.click(screen.getByRole('button', { name: 'Book' }));
  const action = vi.mocked(toast.error).mock.calls[0][1]?.action;
  if (!action || typeof action !== 'object' || !('onClick' in action))
    throw new Error('Expected copy action');
  action.onClick({} as MouseEvent<HTMLButtonElement>);
  await waitFor(() => expect(clipboard).toHaveBeenCalledOnce());
  const copied = JSON.parse(clipboard.mock.calls[0][0]);
  expect(copied.code).toBe('UNEXPECTED_ERROR');
  expect(copied.correlationId).toBe(copied.details.correlationId);
  const diagnostic = log.mock.calls.find(
    ([message]) =>
      message ===
      `[resource-booking:${copied.correlationId}] Unexpected application failure`,
  );
  expect(diagnostic?.[1]).toMatchObject({
    operation: 'booking.create',
    type: 'TypeError',
    stack: expect.stringContaining('booking-diagnostics.test.tsx:'),
  });
  expect(JSON.stringify(diagnostic)).not.toMatch(/owner@example|startAt/);
  expect(await app.listBookings()).toMatchObject({ ok: true, value: [] });
});
