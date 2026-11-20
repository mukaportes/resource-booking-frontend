import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApplicationProvider, useApplication } from '../hooks/use-application';
import { LoginDialog } from './login-dialog';
import { StorageRecovery } from './storage-recovery';

function Identity() {
  const { user } = useApplication();
  return <p>{user ? `Signed in as ${user.email}` : 'No session'}</p>;
}

function renderLogin() {
  return render(
    <ApplicationProvider>
      <Identity />
      <LoginDialog />
      <StorageRecovery />
    </ApplicationProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('email identification', () => {
  it('keeps the blocking modal open on Escape and invalid input, then persists a successful login', async () => {
    const user = userEvent.setup();
    renderLogin();
    const email = await screen.findByLabelText('Work email');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeVisible();
    await user.type(email, 'invalid');
    await user.click(screen.getByRole('button', { name: 'Open workspace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('valid email');
    expect(email).toHaveValue('invalid');
    await user.clear(email);
    await user.type(email, ' Alex@Example.COM ');
    await user.click(screen.getByRole('button', { name: 'Open workspace' }));
    await screen.findByText('Signed in as alex@example.com');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(sessionStorage.getItem('resourceBooking:v1:session')).toContain(
      'userId',
    );
  });

  it('shows corruption recovery without silently replacing stored data', async () => {
    localStorage.setItem('resourceBooking:v1:users', 'broken-json');
    renderLogin();
    expect(
      await screen.findByRole('heading', {
        name: 'Your saved data needs attention',
      }),
    ).toBeVisible();
    expect(screen.queryByLabelText('Work email')).not.toBeInTheDocument();
    expect(localStorage.getItem('resourceBooking:v1:users')).toBe(
      'broken-json',
    );
    const reset = screen.getByRole('button', { name: 'Reset local data' });
    expect(reset).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText('Type RESET to confirm'),
      'RESET',
    );
    await userEvent.click(reset);
    expect(await screen.findByLabelText('Work email')).toBeVisible();
    expect(localStorage.getItem('resourceBooking:v1:users')).toBeNull();
  });
});
