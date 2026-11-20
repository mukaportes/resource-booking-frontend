import { useEffect, useState } from 'react';
import type { BookingApplication } from '../../application';
import type { AvailabilityResult, Result } from '../../domain';
import { notify } from '../lib/notifications';

export function useBookingAvailability(
  app: BookingApplication | null,
  resourceId: string,
  startAt: number,
  endAt: number,
  invalid: string,
  refresh: () => Promise<void>,
) {
  const [availability, setAvailability] = useState<{
    key: string;
    result: Result<AvailabilityResult>;
  } | null>(null);
  const key = `${resourceId}:${startAt}:${endAt}`;
  useEffect(() => {
    if (invalid || !app) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      const checked = await app.checkAvailability(resourceId, startAt, endAt);
      if (!active) return;
      setAvailability({ key, result: checked });
      if (
        !checked.ok &&
        ['STORAGE_CORRUPTED', 'STORAGE_UNAVAILABLE'].includes(
          checked.error.code,
        )
      )
        await refresh();
      else if (
        !checked.ok &&
        ['UNEXPECTED_ERROR', 'STORAGE_QUOTA_EXCEEDED'].includes(
          checked.error.code,
        )
      )
        notify.error(checked.error);
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [app, resourceId, startAt, endAt, invalid, key, refresh]);
  return !invalid && availability?.key === key ? availability.result : null;
}
