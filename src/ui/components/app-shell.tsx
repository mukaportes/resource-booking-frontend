'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ApplicationProvider, useApplication } from '../hooks/use-application';
import { notify } from '../lib/notifications';
import { LoginDialog } from './login-dialog';
import { StorageCapacity } from './storage-capacity';
import { StorageRecovery } from './storage-recovery';
import { Button } from './ui/button';

const toastTheme: CSSProperties & Record<`--${string}`, string> = {
  '--success-text': '#245436',
  '--info-text': 'var(--primary)',
  '--warning-text': '#71490f',
  '--error-text': 'var(--destructive)',
};

function WorkspaceShell({ children }: { children?: ReactNode }) {
  const { app, user, loading, error, refresh, readOnly } = useApplication();
  async function logout() {
    if (!app) return;
    const result = await app.logout();
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    await refresh();
  }
  return (
    <>
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <header className="app-top">
        <div className="wordmark">
          <span className="logo" aria-hidden="true">
            a
          </span>
          alvorada <span className="muted">/ spaces</span>
        </div>
        {user && !error && (
          <div className="identity">
            <span className="avatar" aria-hidden="true">
              {user.email.slice(0, 2).toUpperCase()}
            </span>
            <span className="identity-email">{user.email}</span>
            <Button
              disabled={readOnly}
              variant="ghost"
              onClick={() => {
                void logout();
              }}
            >
              Log out
            </Button>
          </div>
        )}
      </header>
      <main id="workspace" className="atlas-layout" tabIndex={-1}>
        <StorageCapacity />
        {loading ? (
          <div
            role="status"
            aria-label="Loading workspace"
            className="loading-grid"
          >
            <span className="sr-only">Loading your workspace…</span>
            <div className="skeleton skeleton-heading" />
            <div className="skeleton skeleton-cards" />
            <div className="skeleton skeleton-calendar" />
          </div>
        ) : (user || readOnly) && !error ? (
          (children ?? (
            <section className="empty-state">
              <span className="eyebrow">YOUR WORKSPACE</span>
              <h1>Welcome to Alvorada / spaces.</h1>
              <p>
                Your identity is ready. The resource schedule arrives in M04.
              </p>
            </section>
          ))
        ) : (
          <div className="signed-out-shell" aria-hidden="true" />
        )}
      </main>
      <LoginDialog />
      <StorageRecovery />
      <Toaster
        richColors
        closeButton
        position="bottom-right"
        style={toastTheme}
      />
    </>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <ApplicationProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </ApplicationProvider>
  );
}
