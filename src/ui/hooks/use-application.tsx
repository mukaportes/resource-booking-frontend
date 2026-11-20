'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { BookingApplication } from '../../application';
import { createApplication } from '../../infrastructure/create-application';
import type { Booking, DomainError, User } from '../../domain';
import { reportUnexpected } from '../../infrastructure/logger/diagnostics';
import { notify } from '../lib/notifications';

interface ApplicationContextValue {
  app: BookingApplication | null;
  user: User | null;
  bookings: Booking[];
  users: User[];
  readOnly: boolean;
  revision: number;
  loading: boolean;
  error: DomainError | null;
  refresh: () => Promise<void>;
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null);

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<BookingApplication | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DomainError | null>(null);
  const instance = useRef<BookingApplication | null>(null);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    const current = instance.current;
    if (!current) return;
    const identity = await current.initialize();
    if (!mounted.current) return;
    if (!identity.ok) {
      setError(identity.error);
      return;
    }
    setUser(identity.value.user);
    setReadOnly(Boolean(identity.value.readOnly));
    if (identity.value.sessionReset)
      notify.info(
        'Your saved session was reset. Bookings were kept. Please identify yourself again.',
      );
    if (!identity.value.user && !identity.value.readOnly) {
      setBookings([]);
      setUsers([]);
      setError(null);
      return;
    }
    const [bookingResult, userResult] = await Promise.all([
      current.listBookings(),
      current.getUsers(),
    ]);
    if (!mounted.current) return;
    if (!bookingResult.ok) {
      setError(bookingResult.error);
      return;
    }
    if (!userResult.ok) {
      setError(userResult.error);
      return;
    }
    setBookings(bookingResult.value);
    setUsers(userResult.value);
    setError(null);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let current: BookingApplication | undefined;
    async function initialize() {
      if (!current) return;
      try {
        if (!active) return;
        await refresh();
      } catch (error) {
        const correlationId = reportUnexpected(error, 'ui.initialize');
        if (active)
          setError({
            code: 'UNEXPECTED_ERROR',
            message: 'The workspace could not be loaded. Try reloading.',
            details: { correlationId },
          });
      } finally {
        if (active) setLoading(false);
      }
    }
    async function bootstrap() {
      await Promise.resolve();
      if (!active) return;
      try {
        current = createApplication(window.localStorage, window.sessionStorage);
        instance.current = current;
        setApp(current);
        unsubscribe = current.subscribe(() => {
          void refresh();
        });
        await initialize();
      } catch {
        if (active) {
          setError({
            code: 'STORAGE_UNAVAILABLE',
            message:
              'Browser storage is unavailable. Allow site data and reload to continue.',
          });
          setLoading(false);
        }
      }
    }
    void bootstrap();
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && !event.key.startsWith('resourceBooking:v1:'))
        return;
      if (document.querySelector('[role="dialog"]'))
        notify.warning('Bookings were updated in another tab');
      void initialize();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      mounted.current = false;
      unsubscribe?.();
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  return (
    <ApplicationContext.Provider
      value={{
        app,
        user,
        bookings,
        users,
        readOnly,
        revision,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </ApplicationContext.Provider>
  );
}

export function useApplication() {
  const context = useContext(ApplicationContext);
  if (!context)
    throw new Error('useApplication must be used inside ApplicationProvider');
  return context;
}
