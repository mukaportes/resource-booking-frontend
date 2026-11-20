import { failure, success, type Result } from './errors';
import {
  BookingStatus,
  CancelOutcome,
  type AvailabilityResult,
  type Booking,
  type CancelResult,
  type Interval,
} from './types';
import { validateBookingInput } from './validation';

export function overlaps(a: Interval, b: Interval): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

export function checkAvailability(
  bookings: readonly Booking[],
  resourceId: unknown,
  interval: unknown,
): Result<AvailabilityResult> {
  const fields =
    typeof interval === 'object' && interval !== null ? interval : {};
  const validated = validateBookingInput({ ...fields, resourceId });
  if (!validated.ok) return validated;
  const conflicts = bookings
    .filter(
      (booking) =>
        booking.status === BookingStatus.Active &&
        booking.resourceId === validated.value.resourceId &&
        overlaps(booking, validated.value),
    )
    .sort((a, b) => a.id - b.id);
  return success({ isAvailable: conflicts.length === 0, conflicts });
}

export function planBooking(
  bookings: readonly Booking[],
  input: unknown,
  nextId: number,
  now: number,
): Result<Booking> {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('userId' in input) ||
    typeof input.userId !== 'string' ||
    input.userId.length === 0
  ) {
    return failure('UNAUTHENTICATED', 'Identify yourself before booking.');
  }
  const { userId, ...command } = input;
  const validated = validateBookingInput(command);
  if (!validated.ok) return validated;
  if (
    !Number.isSafeInteger(nextId) ||
    nextId < 1 ||
    bookings.some((booking) => booking.id === nextId) ||
    !Number.isFinite(now) ||
    !Number.isInteger(now)
  ) {
    return failure('INVALID_INPUT', 'Booking metadata is invalid.', {
      fields: ['nextId', 'now'],
    });
  }
  const availability = checkAvailability(bookings, validated.value.resourceId, {
    startAt: validated.value.startAt,
    endAt: validated.value.endAt,
  });
  if (!availability.ok) return availability;
  if (!availability.value.isAvailable) {
    return failure(
      'TIME_SLOT_CONFLICT',
      'This resource is already booked during that time.',
      {
        conflicts: availability.value.conflicts,
      },
    );
  }
  return success({
    id: nextId,
    ...validated.value,
    userId,
    status: BookingStatus.Active,
    createdAt: now,
    cancelledAt: null,
  });
}

export function planCancellation(
  booking: Booking | undefined,
  userId: string,
  now: number,
): Result<CancelResult> {
  if (!userId)
    return failure('UNAUTHENTICATED', 'Identify yourself before cancelling.');
  if (!booking)
    return failure('BOOKING_NOT_FOUND', 'This booking does not exist.');
  if (booking.userId !== userId) {
    return failure(
      'NOT_BOOKING_OWNER',
      'Only the booking owner can cancel it.',
      { bookingId: booking.id },
    );
  }
  if (booking.status === BookingStatus.Cancelled) {
    return success({ outcome: CancelOutcome.AlreadyCancelled, booking });
  }
  if (!Number.isFinite(now) || !Number.isInteger(now)) {
    return failure('INVALID_INPUT', 'Cancellation time is invalid.', {
      fields: ['now'],
    });
  }
  return success({
    outcome: CancelOutcome.Cancelled,
    booking: { ...booking, status: BookingStatus.Cancelled, cancelledAt: now },
  });
}
