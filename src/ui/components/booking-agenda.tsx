import { useMemo, useState } from 'react';
import { RESOURCES, type Booking, type User } from '../../domain';
import { formatRange } from '../lib/time';
import { Button } from './ui/button';

export function BookingAgenda({
  bookings,
  users,
  userId,
  onBooking,
}: {
  bookings: Booking[];
  users: User[];
  userId: string;
  onBooking: (booking: Booking) => void;
}) {
  const [page, setPage] = useState(0);
  const owners = useMemo(
    () => new Map(users.map((user) => [user.userId, user.email])),
    [users],
  );
  const sorted = useMemo(
    () => [...bookings].sort((a, b) => a.startAt - b.startAt || a.id - b.id),
    [bookings],
  );
  const pages = Math.max(1, Math.ceil(sorted.length / 10));
  const current = Math.min(page, pages - 1);
  return (
    <section aria-labelledby="shared-week-heading" className="week-agenda">
      <h3 id="shared-week-heading">Shared week overview</h3>
      <p className="muted text-small">
        Bookings in the viewed week, sorted by time. Choose one resource for its
        week time grid.
      </p>
      <ol className="agenda-list">
        {sorted.slice(current * 10, (current + 1) * 10).map((booking) => (
          <li key={booking.id}>
            <Button
              variant="outline"
              className="agenda-booking"
              data-status={booking.status}
              onClick={() => onBooking(booking)}
              aria-label={`Details for booking ${booking.id}`}
              aria-describedby={`agenda-resource-${booking.id} agenda-owner-${booking.id} agenda-time-${booking.id} agenda-status-${booking.id}`}
            >
              <strong id={`agenda-resource-${booking.id}`}>
                {
                  RESOURCES.find(
                    (resource) => resource.id === booking.resourceId,
                  )?.name
                }{' '}
                · #{booking.id}
              </strong>
              <span id={`agenda-owner-${booking.id}`}>
                {owners.get(booking.userId) ?? 'Unknown owner'}
                {booking.userId === userId ? ' · You' : ''}
              </span>
              <span id={`agenda-time-${booking.id}`}>
                {formatRange(booking.startAt, booking.endAt)}
              </span>
              <span
                id={`agenda-status-${booking.id}`}
                className={`status-badge ${booking.status}`}
              >
                {booking.status === 'active' ? 'Active' : 'Cancelled'}
              </span>
            </Button>
          </li>
        ))}
      </ol>
      {!bookings.length && (
        <p className="empty-state">
          No bookings in this week. Use New booking to reserve a resource.
        </p>
      )}
      <nav aria-label="Week overview pages" className="history-pagination">
        <Button
          variant="outline"
          size="sm"
          disabled={current === 0}
          onClick={() => setPage(current - 1)}
        >
          Previous page
        </Button>
        <span role="status">
          Page {current + 1} of {pages} · {bookings.length} bookings
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next page
        </Button>
      </nav>
    </section>
  );
}
