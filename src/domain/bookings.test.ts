import { describe, expect, it } from 'vitest';
import {
  BookingStatus,
  CancelOutcome,
  checkAvailability,
  planBooking,
  planCancellation,
  validateBookingInput,
  bookingSchema,
  userSchema,
  type Booking,
  type Result,
} from './index';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}
function booking(id = 1, startAt = 10, endAt = 20): Booking {
  return {
    id,
    resourceId: 'room-1',
    userId: owner,
    startAt,
    endAt,
    status: BookingStatus.Active,
    createdAt: 0,
    cancelledAt: null,
  };
}
function create(
  bookings: Booking[],
  resourceId: string,
  startAt: number,
  endAt: number,
  nextId: number,
) {
  return planBooking(
    bookings,
    { resourceId, startAt, endAt, userId: owner },
    nextId,
    0,
  );
}

describe('challenge acceptance scenario', () => {
  it('preserves half-open intervals, rejected IDs, freed slots and cancellation identity', () => {
    const bookings: Booking[] = [];
    bookings.push(value(create(bookings, 'room-1', 10, 20, 1)));
    bookings.push(value(create(bookings, 'room-1', 20, 30, 2)));
    const rejected = create(bookings, 'room-1', 19, 21, 3);
    expect(rejected).toMatchObject({
      ok: false,
      error: {
        code: 'TIME_SLOT_CONFLICT',
        details: { conflicts: [{ id: 1 }, { id: 2 }] },
      },
    });
    expect(bookings).toHaveLength(2);
    bookings.push(value(create(bookings, 'room-2', 19, 21, 3)));
    expect(
      value(checkAvailability(bookings, 'room-1', { startAt: 19, endAt: 21 })),
    ).toMatchObject({ isAvailable: false, conflicts: [{ id: 1 }, { id: 2 }] });
    const cancellation = value(planCancellation(bookings[0], owner, 50));
    expect(cancellation.outcome).toBe(CancelOutcome.Cancelled);
    bookings[0] = cancellation.booking;
    expect(
      value(checkAvailability(bookings, 'room-1', { startAt: 10, endAt: 20 })),
    ).toEqual({ isAvailable: true, conflicts: [] });
    bookings.push(value(create(bookings, 'room-1', 10, 20, 4)));
    expect(bookings.map((item) => item.id)).toEqual([1, 2, 3, 4]);
    const repeated = value(planCancellation(bookings[0], owner, 99));
    expect(repeated.outcome).toBe(CancelOutcome.AlreadyCancelled);
    expect(repeated.booking).toBe(cancellation.booking);
    expect(repeated.booking.cancelledAt).toBe(50);
  });
});

describe('availability and validation', () => {
  it('sorts conflicts without mutating input and ignores other resources and cancelled bookings', () => {
    const records = [
      booking(5),
      { ...booking(3), status: BookingStatus.Cancelled, cancelledAt: 1 },
      { ...booking(2), resourceId: 'room-2' as const },
      booking(1),
    ];
    const before = JSON.stringify(records);
    expect(
      value(
        checkAvailability(records, 'room-1', { startAt: 15, endAt: 16 }),
      ).conflicts.map((item) => item.id),
    ).toEqual([1, 5]);
    expect(JSON.stringify(records)).toBe(before);
  });
  it.each([
    [10, 10],
    [20, 10],
  ])('rejects non-positive interval %s–%s', (startAt, endAt) => {
    expect(
      validateBookingInput({ resourceId: 'room-1', startAt, endAt }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INTERVAL' } });
  });
  it.each([NaN, Infinity, 1.2, null, undefined, '10'])(
    'rejects invalid time %s',
    (startAt) => {
      expect(
        validateBookingInput({ resourceId: 'room-1', startAt, endAt: 20 }),
      ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    },
  );
  it.each([
    null,
    undefined,
    {},
    [],
    { resourceId: 'room-1', startAt: 10, endAt: 20, extra: true },
  ])('rejects missing and unexpected shape %s', (input) => {
    expect(validateBookingInput(input)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
  });
  it('validates input types, then resource, then interval', () => {
    expect(
      validateBookingInput({ resourceId: 'missing', startAt: NaN, endAt: 0 }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(
      validateBookingInput({ resourceId: 'missing', startAt: 1, endAt: 0 }),
    ).toMatchObject({ ok: false, error: { code: 'RESOURCE_NOT_FOUND' } });
  });
  it('does not apply the application time grid or current-clock policy', () => {
    expect(create([], 'room-1', -10, 11, 1).ok).toBe(true);
  });
  it('rejects invalid metadata and an already used ID', () => {
    expect(create([], 'room-1', 10, 20, 0)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(create([booking()], 'room-2', 10, 20, 1)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
  });
});

describe('cancellation authorization', () => {
  it.each([BookingStatus.Active, BookingStatus.Cancelled])(
    'checks owner before %s status',
    (status) => {
      const original = {
        ...booking(),
        status,
        cancelledAt: status === BookingStatus.Cancelled ? 1 : null,
      };
      const before = JSON.stringify(original);
      expect(planCancellation(original, other, 20)).toMatchObject({
        ok: false,
        error: { code: 'NOT_BOOKING_OWNER' },
      });
      expect(JSON.stringify(original)).toBe(before);
    },
  );
  it('checks identity before existence and reports unknown bookings', () => {
    expect(planCancellation(undefined, '', 0)).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    });
    expect(planCancellation(undefined, owner, 0)).toMatchObject({
      ok: false,
      error: { code: 'BOOKING_NOT_FOUND' },
    });
  });
  it('allows cancelling past and ongoing bookings without mutating the source', () => {
    const original = booking();
    const cancelled = value(planCancellation(original, owner, 15));
    expect(cancelled.booking.cancelledAt).toBe(15);
    expect(original.status).toBe(BookingStatus.Active);
  });
  it('checks session before creation input', () => {
    expect(planBooking([], null, 1, 0)).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    });
  });
});

describe('stored model schemas', () => {
  it('rejects unknown fields, invalid intervals and inconsistent cancellation metadata', () => {
    expect(bookingSchema.safeParse({ ...booking(), extra: true }).success).toBe(
      false,
    );
    expect(bookingSchema.safeParse({ ...booking(), endAt: 10 }).success).toBe(
      false,
    );
    expect(
      bookingSchema.safeParse({ ...booking(), cancelledAt: 1 }).success,
    ).toBe(false);
    expect(
      bookingSchema.safeParse({ ...booking(), status: BookingStatus.Cancelled })
        .success,
    ).toBe(false);
  });
  it('accepts only normalized persisted emails', () => {
    const user = { userId: owner, email: 'owner@example.com', createdAt: 0 };
    expect(userSchema.safeParse(user).success).toBe(true);
    expect(
      userSchema.safeParse({ ...user, email: ' Owner@example.com ' }).success,
    ).toBe(false);
  });
});
