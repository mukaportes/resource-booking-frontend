import { useState } from 'react';
import { RESOURCES, type Booking, type User } from '../../domain';
import { formatDateTime } from '../lib/time';
import { Button } from './ui/button';
export function BookingTable({
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
  const [sort, setSort] = useState<'start' | 'id'>('start');
  const sorted = [...bookings].sort((a, b) =>
    sort === 'id' ? a.id - b.id : a.startAt - b.startAt || a.id - b.id,
  );
  return (
    <div className="table-wrap">
      <table className="booking-table">
        <caption className="sr-only">
          Bookings, including cancelled records
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSort('id')}
                aria-pressed={sort === 'id'}
              >
                ID ↑
              </Button>
            </th>
            <th scope="col">Resource</th>
            <th scope="col">Owner</th>
            <th scope="col">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSort('start')}
                aria-pressed={sort === 'start'}
              >
                Start ↑
              </Button>
            </th>
            <th scope="col">End</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((booking) => (
            <tr key={booking.id}>
              <td>#{booking.id}</td>
              <td>
                {
                  RESOURCES.find(
                    (resource) => resource.id === booking.resourceId,
                  )?.name
                }
              </td>
              <td>
                {users.find((user) => user.userId === booking.userId)?.email ??
                  'Unknown owner'}
                {booking.userId === userId && (
                  <small className="owner-label">You</small>
                )}
              </td>
              <td>{formatDateTime(booking.startAt)}</td>
              <td>{formatDateTime(booking.endAt)}</td>
              <td>
                <span className={`status-badge ${booking.status}`}>
                  {booking.status === 'active' ? 'Active' : 'Cancelled'}
                </span>
              </td>
              <td>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Details for booking ${booking.id}`}
                  onClick={() => onBooking(booking)}
                >
                  Details
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sorted.length && (
        <p className="empty-state">No bookings match this view.</p>
      )}
    </div>
  );
}
