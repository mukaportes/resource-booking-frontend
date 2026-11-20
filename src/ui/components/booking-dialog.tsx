import { useEffect, useState, type FormEvent } from 'react';
import {
  RESOURCES,
  resourceIdSchema,
  type DomainError,
  type ResourceId,
} from '../../domain';
import { useApplication } from '../hooks/use-application';
import { useBookingAvailability } from '../hooks/use-booking-availability';
import { notify } from '../lib/notifications';
import {
  SLOT_MS,
  formatRange,
  toDateInput,
  toEpochMs,
  toTimeInput,
} from '../lib/time';
import { Button } from './ui/button';
import { BookingFormFields } from './booking-form-fields';
import { BookingAvailability } from './booking-availability';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export interface BookingSelection {
  startAt: number;
  endAt: number;
  resourceId?: ResourceId;
}
export function BookingDialog({
  selection,
  onClose,
}: {
  selection: BookingSelection;
  onClose: () => void;
}) {
  const { app, users, refresh } = useApplication();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const initial = {
    resourceId: selection.resourceId ?? '',
    startDate: toDateInput(selection.startAt),
    endDate: toDateInput(selection.endAt),
    startTime: toTimeInput(selection.startAt),
    endTime: toTimeInput(selection.endAt),
  };
  const [fields, setFields] = useState(initial);
  const [submitError, setSubmitError] = useState<DomainError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [discard, setDiscard] = useState(false);
  const startAt = toEpochMs(fields.startDate, fields.startTime);
  const endAt = toEpochMs(fields.endDate, fields.endTime);
  const resource = resourceIdSchema.safeParse(fields.resourceId);
  const invalid = !resource.success
    ? 'Choose a resource.'
    : !Number.isFinite(startAt) || !Number.isFinite(endAt)
      ? 'Enter a valid start and end.'
      : endAt <= startAt
        ? 'End time must be after start time.'
        : startAt % SLOT_MS || endAt % SLOT_MS
          ? 'Choose times on the 30-minute grid.'
          : startAt < now
            ? 'Choose a start time in the future.'
            : '';
  const result = useBookingAvailability(
    app,
    fields.resourceId,
    startAt,
    endAt,
    invalid,
    refresh,
  );
  const dirty = Object.entries(fields).some(
    ([name, value]) => value !== initial[name as keyof typeof initial],
  );
  function update(name: keyof typeof fields, value: string) {
    setFields((previous) => ({ ...previous, [name]: value }));
    setSubmitError(null);
  }
  function close() {
    if (submitting) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !app ||
      invalid ||
      submitting ||
      !result?.ok ||
      !result.value.isAvailable
    )
      return;
    setSubmitting(true);
    try {
      const created = await app.createBooking({
        resourceId: fields.resourceId,
        startAt,
        endAt,
      });
      if (!created.ok) {
        if (
          ['STORAGE_CORRUPTED', 'STORAGE_UNAVAILABLE'].includes(
            created.error.code,
          )
        )
          await refresh();
        else if (
          ['STORAGE_QUOTA_EXCEEDED', 'UNEXPECTED_ERROR'].includes(
            created.error.code,
          )
        )
          notify.error(created.error);
        else setSubmitError(created.error);
        return;
      }
      await refresh();
      const name = RESOURCES.find(
        (item) => item.id === created.value.resourceId,
      )?.name;
      notify.success(
        `Booking #${created.value.id} · ${name} · ${formatRange(startAt, endAt)}`,
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  }
  const conflicts =
    submitError?.details?.conflicts ??
    (result?.ok ? result.value.conflicts : []);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          close();
        }}
        onPointerDownOutside={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {discard ? 'Discard this booking?' : 'New booking'}
          </DialogTitle>
          <DialogDescription>
            {discard
              ? 'Your changes have not been saved.'
              : 'Choose a resource and a time. Availability is checked again when you book.'}
          </DialogDescription>
        </DialogHeader>
        {discard ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscard(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={onClose}>
              Discard changes
            </Button>
          </DialogFooter>
        ) : (
          <form onSubmit={submit} className="form-stack" noValidate>
            <BookingFormFields
              fields={fields}
              update={update}
              startAt={startAt}
            />
            <BookingAvailability
              invalid={invalid}
              submitError={submitError}
              result={result}
              conflicts={conflicts}
              users={users}
            />
            {submitError && (
              <p role="alert" className="field-error">
                {submitError.message}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" disabled={submitting} onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  Boolean(invalid) ||
                  !result?.ok ||
                  !result.value.isAvailable ||
                  submitting ||
                  Boolean(submitError)
                }
              >
                {submitting ? 'Booking…' : 'Book'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
