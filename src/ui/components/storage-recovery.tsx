'use client';

import { useState } from 'react';
import { useApplication } from '../hooks/use-application';
import { notify } from '../lib/notifications';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export function StorageRecovery() {
  const { app, error, refresh } = useApplication();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const corrupted = error?.code === 'STORAGE_CORRUPTED';

  async function exportData() {
    if (!app) return;
    const result = await app.exportRawData();
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    const url = URL.createObjectURL(
      new Blob([result.value], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'resource-booking-recovery.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function resetData() {
    if (!app || busy) return;
    setBusy(true);
    try {
      const result = await app.resetLocalData(confirmation);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      await refresh();
      setConfirmation('');
      notify.info('Local data was reset. Please identify yourself again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(error)}>
      <DialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {corrupted
              ? 'Your saved data needs attention'
              : 'The workspace can’t access its data'}
          </DialogTitle>
          <DialogDescription>{error?.message}</DialogDescription>
        </DialogHeader>
        {corrupted ? (
          <>
            <p>
              Export a copy before resetting. Resetting permanently removes this
              browser’s bookings, users and session.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void exportData();
              }}
            >
              Export raw data
            </Button>
            <div className="form-stack">
              <label htmlFor="reset-confirmation">Type RESET to confirm</label>
              <Input
                id="reset-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={confirmation !== 'RESET' || busy}
                onClick={() => {
                  void resetData();
                }}
              >
                {busy ? 'Resetting…' : 'Reset local data'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <p>
              Allow site data in your browser settings, disable private browsing
              if needed, then try again.
            </p>
            <DialogFooter>
              <Button onClick={() => window.location.reload()}>
                Reload workspace
              </Button>
            </DialogFooter>
          </>
        )}
        <p className="muted text-small">{error?.code}</p>
      </DialogContent>
    </Dialog>
  );
}
