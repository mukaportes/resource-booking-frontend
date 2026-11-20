'use client';

import { useState, type FormEvent } from 'react';
import { useApplication } from '../hooks/use-application';
import { notify } from '../lib/notifications';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export function LoginDialog() {
  const { app, user, loading, error, refresh, readOnly } = useApplication();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!app || submitting) return;
    setSubmitting(true);
    try {
      const result = await app.login(email);
      if (!result.ok) {
        if (result.error.code === 'INVALID_EMAIL')
          setFieldError(result.error.message);
        else if (
          result.error.code === 'STORAGE_CORRUPTED' ||
          result.error.code === 'STORAGE_UNAVAILABLE'
        )
          await refresh();
        else notify.error(result.error);
        return;
      }
      setFieldError('');
      await refresh();
      notify.success('You’re signed in. Welcome to your workspace.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!loading && !user && !error && !readOnly}>
      <DialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <span className="eyebrow">ALVORADA / SPACES</span>
          <DialogTitle>A little space to do great work.</DialogTitle>
          <DialogDescription>
            Identify yourself with your email to find a room or device. This
            demo uses email identity without verification.
          </DialogDescription>
        </DialogHeader>
        <form className="form-stack" onSubmit={submit} noValidate>
          <label htmlFor="login-email">Work email</label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            maxLength={254}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldError('');
            }}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? 'email-error' : undefined}
            placeholder="you@company.com"
          />
          {fieldError && (
            <p id="email-error" className="field-error" role="alert">
              {fieldError}
            </p>
          )}
          <Button type="submit" disabled={submitting || !app}>
            {submitting ? 'Signing in…' : 'Open workspace'}
          </Button>
          <p className="muted text-small">
            Your session stays in this tab. Bookings are saved in this browser.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
