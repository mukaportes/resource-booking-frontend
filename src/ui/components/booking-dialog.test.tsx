import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApplication } from '../../infrastructure/create-application';
import { BookingStatus, failure, type User } from '../../domain';
import { useApplication } from '../hooks/use-application';
import { SLOT_MS, toDateInput } from '../lib/time';
import { BookingDialog } from './booking-dialog';

vi.mock('../hooks/use-application', () => ({ useApplication: vi.fn() }));
vi.mock('../lib/notifications', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
const startAt = Math.ceil((Date.now() + 86_400_000) / SLOT_MS) * SLOT_MS;
let app: ReturnType<typeof createApplication>;
let user: User;
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  app = createApplication(localStorage, sessionStorage);
  const signedIn = await app.login('owner@example.com');
  if (!signedIn.ok) throw new Error(signedIn.error.message);
  user = signedIn.value;
  vi.mocked(useApplication).mockReturnValue({
    app,
    user,
    users: [user],
    bookings: [],
    loading: false,
    error: null,
    refresh: vi.fn(async () => {}),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('booking submission', () => {
  it('actually saves a valid booking and closes after success', async () => {
    const onClose = vi.fn();
    render(
      <BookingDialog
        selection={{ startAt, endAt: startAt + SLOT_MS, resourceId: 'room-1' }}
        onClose={onClose}
      />,
    );
    const book = screen.getByRole('button', { name: 'Book' });
    expect(book).toBeDisabled();
    await waitFor(() => expect(book).toBeEnabled());
    await userEvent.click(book);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    const saved = await app.listBookings();
    expect(saved).toMatchObject({
      ok: true,
      value: [{ id: 1, resourceId: 'room-1', startAt, userId: user.userId }],
    });
  });
  it('preserves inputs and explains a conflict detected only at commit time', async () => {
    const onClose = vi.fn();
    vi.spyOn(app, 'createBooking').mockResolvedValue(
      failure('TIME_SLOT_CONFLICT', 'This slot was just booked.', {
        conflicts: [
          {
            id: 7,
            resourceId: 'room-1',
            userId: user.userId,
            startAt,
            endAt: startAt + SLOT_MS,
            status: BookingStatus.Active,
            createdAt: 0,
            cancelledAt: null,
          },
        ],
      }),
    );
    render(
      <BookingDialog
        selection={{ startAt, endAt: startAt + SLOT_MS, resourceId: 'room-1' }}
        onClose={onClose}
      />,
    );
    const book = screen.getByRole('button', { name: 'Book' });
    await waitFor(() => expect(book).toBeEnabled());
    await userEvent.click(book);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This slot was just booked.',
    );
    expect(screen.getByText(/#7 · Room 1 · owner@example.com/)).toBeVisible();
    expect(screen.getByLabelText('Start date')).toHaveValue(
      toDateInput(startAt),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(book).toBeDisabled();
  });
  it('keeps transient quota failures retryable and reports them through a toast', async () => {
    const { notify } = await import('../lib/notifications');
    const onClose = vi.fn();
    const create = vi.spyOn(app, 'createBooking');
    create.mockResolvedValueOnce(
      failure('STORAGE_QUOTA_EXCEEDED', 'Storage is full.'),
    );
    render(
      <BookingDialog
        selection={{ startAt, endAt: startAt + SLOT_MS, resourceId: 'room-1' }}
        onClose={onClose}
      />,
    );
    const book = screen.getByRole('button', { name: 'Book' });
    await waitFor(() => expect(book).toBeEnabled());
    await userEvent.click(book);
    expect(notify.error).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'STORAGE_QUOTA_EXCEEDED' }),
    );
    expect(book).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(book);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('requires a resource with multiple resources selected and confirms discarding changes', async () => {
    const onClose = vi.fn();
    render(
      <BookingDialog
        selection={{ startAt, endAt: startAt + SLOT_MS }}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('button', { name: 'Book' })).toBeDisabled();
    await userEvent.selectOptions(
      screen.getByLabelText('Resource'),
      'tablet-2',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.getByRole('heading', { name: 'Discard this booking?' }),
    ).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Discard changes' }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});
