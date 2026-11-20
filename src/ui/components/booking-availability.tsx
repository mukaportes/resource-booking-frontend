import {
  RESOURCES,
  type AvailabilityResult,
  type Booking,
  type DomainError,
  type Result,
  type User,
} from '../../domain';
import { formatRange } from '../lib/time';
export function BookingAvailability({
  invalid,
  submitError,
  result,
  conflicts,
  users,
}: {
  invalid: string;
  submitError: DomainError | null;
  result: Result<AvailabilityResult> | null;
  conflicts: Booking[];
  users: User[];
}) {
  return (
    <div
      aria-live="polite"
      className={`availability ${conflicts.length ? 'unavailable' : ''}`}
    >
      {invalid ||
        (submitError?.code !== 'TIME_SLOT_CONFLICT' && submitError?.message) ||
        (result && !result.ok
          ? result.error.message
          : result?.ok
            ? result.value.isAvailable
              ? '✓ Available'
              : 'This time is unavailable.'
            : 'Checking availability…')}
      {conflicts.length > 0 && (
        <ul className="conflict-list">
          {conflicts.map((booking) => (
            <li key={booking.id}>
              #{booking.id} ·{' '}
              {RESOURCES.find((item) => item.id === booking.resourceId)?.name} ·{' '}
              {users.find((item) => item.userId === booking.userId)?.email ??
                'Unknown owner'}
              <br />
              {formatRange(booking.startAt, booking.endAt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
