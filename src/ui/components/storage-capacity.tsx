import { useState } from 'react';
import { useApplication } from '../hooks/use-application';
import { notify } from '../lib/notifications';
import { exportRecoveryData } from '../lib/export-recovery';
import { Button } from './ui/button';

export function StorageCapacity() {
  const { app, readOnly, refresh } = useApplication();
  const [busy, setBusy] = useState(false);
  if (!readOnly || !app) return null;
  return (
    <section className="empty-state" aria-label="Storage capacity recovery">
      <h2>Storage is full — read-only workspace</h2>
      <p>
        You can inspect saved bookings and export a copy. Creating bookings,
        cancelling and changing identity are disabled.
      </p>
      <p>
        Export first, then free browser storage capacity in site settings.
        Clearing this site’s data deletes its history. Retry storage after
        capacity is available.
      </p>
      <Button variant="outline" onClick={() => void exportRecoveryData(app)}>
        Export raw data
      </Button>{' '}
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await refresh();
            notify.info(
              'Storage checked. Editing resumes only when both storage probes succeed.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Retry storage
      </Button>
    </section>
  );
}
