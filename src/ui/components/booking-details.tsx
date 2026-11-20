import { useState } from 'react';
import {
  BookingStatus,
  CancelOutcome,
  RESOURCES,
  type Booking,
} from '../../domain';
import { useApplication } from '../hooks/use-application';
import { notify } from '../lib/notifications';
import { formatDateTime, formatRange } from '../lib/time';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
export function BookingDetails({
  booking,
  onClose,
}: {
  booking: Booking;
  onClose: () => void;
}) {
  const { app, user, users, refresh } = useApplication();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const resource = RESOURCES.find((item) => item.id === booking.resourceId);
  async function cancel() {
    if (!app || submitting) return;
    setSubmitting(true);
    try {
      const result = await app.cancelBooking(booking.id);
      if (!result.ok) {
        if (
          ['STORAGE_CORRUPTED', 'STORAGE_UNAVAILABLE'].includes(
            result.error.code,
          )
        )
          await refresh();
        else notify.error(result.error);
        return;
      }
      await refresh();
      if (result.value.outcome === CancelOutcome.AlreadyCancelled)
        notify.info(`Booking #${booking.id} was already cancelled.`);
      else
        notify.success(
          `Booking #${booking.id} cancelled. The slot is now available.`,
        );
      onClose();
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {confirming
              ? `Cancel booking #${booking.id}?`
              : `Booking #${booking.id}`}
          </DialogTitle>
          <DialogDescription>
            {confirming
              ? `Release ${resource?.name}, ${formatRange(booking.startAt, booking.endAt)}? This keeps the booking in your history.`
              : 'The resource, time and owner for this reservation.'}
          </DialogDescription>
        </DialogHeader>
        {!confirming && (
          <dl className="detail-grid">
            <dt>Resource</dt>
            <dd>{resource?.name}</dd>
            <dt>Owner</dt>
            <dd>
              {users.find((item) => item.userId === booking.userId)?.email ??
                'Unknown owner'}
            </dd>
            <dt>Start</dt>
            <dd>{formatDateTime(booking.startAt)}</dd>
            <dt>End</dt>
            <dd>{formatDateTime(booking.endAt)}</dd>
            <dt>Status</dt>
            <dd>
              {booking.status === BookingStatus.Active ? 'Active' : 'Cancelled'}
            </dd>
            <dt>Created</dt>
            <dd>{formatDateTime(booking.createdAt)}</dd>
          </dl>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => (confirming ? setConfirming(false) : onClose())}
          >
            {confirming ? 'Keep booking' : 'Close'}
          </Button>
          {booking.userId === user?.userId &&
            booking.status === BookingStatus.Active && (
              <Button
                variant="destructive"
                disabled={submitting}
                onClick={() =>
                  confirming ? void cancel() : setConfirming(true)
                }
              >
                {submitting
                  ? 'Cancelling…'
                  : confirming
                    ? 'Confirm cancellation'
                    : 'Cancel booking'}
              </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
