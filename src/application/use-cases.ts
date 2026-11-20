import {
  emailSchema,
  failure,
  success,
  validateBookingInput,
  type BookingRepository,
  type Result,
  type SessionStore,
  type User,
  type UserRepository,
} from '../domain';
import type { BookingApplication } from './contracts';

export interface ApplicationRuntime {
  assertWritable?(): void;
  isReadOnly?(): boolean;
  run<T>(operation: () => Promise<T>, context?: string): Promise<Result<T>>;
  initialize(): Promise<
    Result<{ user: User | null; sessionReset: boolean; readOnly?: boolean }>
  >;
  exportRawData(): Promise<Result<string>>;
  resetLocalData(): Promise<Result<void>>;
}

export function createBookingUseCases(
  bookings: BookingRepository,
  users: UserRepository,
  session: SessionStore,
  runtime: ApplicationRuntime,
  clock: () => number,
): BookingApplication {
  const subscribers = new Set<() => void>();
  const notify = () => subscribers.forEach((listener) => listener());
  const user = async () => {
    const userId = await session.getUserId();
    if (!userId) return null;
    const current = (await users.list()).find(
      (candidate) => candidate.userId === userId,
    );
    if (!current && !runtime.isReadOnly?.()) await session.clear();
    return current ?? null;
  };
  const authenticated = async (): Promise<Result<User>> => {
    const current = await user();
    return current
      ? success(current)
      : failure('UNAUTHENTICATED', 'Identify yourself before using bookings.');
  };
  const execute = async <T>(
    operation: () => Promise<Result<T>>,
    mutation = false,
    context = 'application.query',
  ): Promise<Result<T>> => {
    const wrapped = await runtime.run(async () => {
      if (mutation) runtime.assertWritable?.();
      return operation();
    }, context);
    const result = wrapped.ok ? wrapped.value : wrapped;
    if (mutation && result.ok) notify();
    return result;
  };

  return {
    initialize: () => runtime.initialize(),
    login: (email) =>
      execute(
        async () => {
          const parsed = emailSchema.safeParse(email);
          if (!parsed.success)
            return failure(
              'INVALID_EMAIL',
              'Enter a valid email address (up to 254 characters).',
              { field: 'email' },
            );
          const current = await users.identify(parsed.data);
          await session.setUserId(current.userId);
          return success(current);
        },
        true,
        'identity.login',
      ),
    logout: () =>
      execute(
        async () => {
          await session.clear();
          return success(undefined);
        },
        true,
        'identity.logout',
      ),
    getCurrentUser: () => runtime.run(user, 'identity.current'),
    getUsers: () =>
      execute(async () => {
        const current = await authenticated();
        return current.ok || runtime.isReadOnly?.()
          ? success(await users.list())
          : current;
      }),
    listBookings: (filter = {}) =>
      execute(async () => {
        const current = await authenticated();
        return current.ok || runtime.isReadOnly?.()
          ? success(await bookings.list(filter))
          : current;
      }),
    createBooking: (input) =>
      execute(
        async () => {
          const current = await authenticated();
          if (!current.ok) return current;
          const validated = validateBookingInput(input);
          if (!validated.ok) return validated;
          if (
            validated.value.startAt % 1_800_000 !== 0 ||
            validated.value.endAt % 1_800_000 !== 0
          ) {
            return failure('OFF_GRID_TIME', 'Use 30-minute time slots.', {
              slotMinutes: 30,
            });
          }
          const now = clock();
          if (validated.value.startAt < now)
            return failure(
              'START_IN_PAST',
              'Choose a start time in the future.',
              { now },
            );
          return bookings.create(validated.value, current.value.userId);
        },
        true,
        'booking.create',
      ),
    cancelBooking: (id) =>
      execute(
        async () => {
          const current = await authenticated();
          return current.ok
            ? bookings.cancel(id, current.value.userId)
            : current;
        },
        true,
        'booking.cancel',
      ),
    checkAvailability: (resourceId, startAt, endAt) =>
      execute(async () => {
        const current = await authenticated();
        if (!current.ok) return current;
        const validated = validateBookingInput({ resourceId, startAt, endAt });
        if (!validated.ok) return validated;
        return bookings.checkAvailability(
          validated.value.resourceId,
          validated.value.startAt,
          validated.value.endAt,
        );
      }),
    subscribe: (listener) => {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
    exportRawData: () => runtime.exportRawData(),
    resetLocalData: (confirmation) =>
      execute(
        async () => {
          if (confirmation !== 'RESET')
            return failure(
              'INVALID_INPUT',
              'Type RESET to confirm data deletion.',
              { fields: ['confirmation'] },
            );
          return runtime.resetLocalData();
        },
        true,
        'storage.reset',
      ),
  };
}
