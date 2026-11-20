import {
  CancelOutcome,
  checkAvailability,
  planBooking,
  planCancellation,
  type BookingFilter,
  type BookingRepository,
  type CreateBookingInput,
  type ResourceId,
  type SessionStore,
  type UserRepository,
} from '../../domain';
import { capture } from '../storage/safe-storage';
import { LocalData, STORAGE_KEYS } from './local-data';

export class LocalBookingRepository implements BookingRepository {
  constructor(
    private readonly data: LocalData,
    private readonly clock: () => number,
  ) {}

  async list(filter: BookingFilter) {
    return this.data
      .read()
      .bookings.filter(
        (booking) =>
          (!filter.resourceIds ||
            filter.resourceIds.includes(booking.resourceId)) &&
          (filter.from === undefined || booking.endAt > filter.from) &&
          (filter.to === undefined || booking.startAt < filter.to) &&
          (!filter.status || filter.status.includes(booking.status)),
      )
      .sort(
        (first, second) =>
          first.startAt - second.startAt || first.id - second.id,
      )
      .map((booking) => ({ ...booking }));
  }

  async getById(id: number) {
    const booking = this.data
      .read()
      .bookings.find((booking) => booking.id === id);
    return booking ? { ...booking } : undefined;
  }

  async create(input: CreateBookingInput, userId: string) {
    const wrapped = capture(() => {
      const snapshot = this.data.read();
      const result = planBooking(
        snapshot.bookings,
        { ...input, userId },
        snapshot.lastIssuedId + 1,
        this.clock(),
      );
      if (result.ok)
        this.data.saveBookings(
          [...snapshot.bookings, result.value],
          result.value.id,
        );
      if (!result.ok && result.error.details?.conflicts) {
        return {
          ...result,
          error: {
            ...result.error,
            details: {
              ...result.error.details,
              conflicts: result.error.details.conflicts.map((booking) => ({
                ...booking,
              })),
            },
          },
        };
      }
      return result;
    }, 'booking.create');
    return wrapped.ok ? wrapped.value : wrapped;
  }

  async cancel(id: number, userId: string) {
    const wrapped = capture(() => {
      const snapshot = this.data.read();
      const result = planCancellation(
        snapshot.bookings.find((booking) => booking.id === id),
        userId,
        this.clock(),
      );
      if (result.ok && result.value.outcome === CancelOutcome.Cancelled) {
        this.data.saveBookings(
          snapshot.bookings.map((booking) =>
            booking.id === id ? result.value.booking : booking,
          ),
          snapshot.lastIssuedId,
        );
      }
      return result.ok
        ? {
            ...result,
            value: { ...result.value, booking: { ...result.value.booking } },
          }
        : result;
    }, 'booking.cancel');
    return wrapped.ok ? wrapped.value : wrapped;
  }

  async checkAvailability(
    resourceId: ResourceId,
    startAt: number,
    endAt: number,
  ) {
    const result = capture(() => {
      const checked = checkAvailability(this.data.read().bookings, resourceId, {
        startAt,
        endAt,
      });
      return checked.ok
        ? {
            ...checked,
            value: {
              ...checked.value,
              conflicts: checked.value.conflicts.map((booking) => ({
                ...booking,
              })),
            },
          }
        : checked;
    }, 'booking.availability');
    return result.ok ? result.value : result;
  }
}

export class LocalUserRepository implements UserRepository {
  constructor(
    private readonly data: LocalData,
    private readonly clock: () => number,
  ) {}
  async list() {
    return this.data.read().users.map((user) => ({ ...user }));
  }
  async identify(normalizedEmail: string) {
    const users = this.data.read().users;
    const existing = users.find((user) => user.email === normalizedEmail);
    if (existing) return { ...existing };
    const user = {
      userId: crypto.randomUUID(),
      email: normalizedEmail,
      createdAt: this.clock(),
    };
    this.data.saveUsers([...users, user]);
    return user;
  }
}

export class LocalSessionStore implements SessionStore {
  constructor(private readonly data: LocalData) {}
  async getUserId() {
    return this.data.sessionUserId();
  }
  async setUserId(userId: string) {
    this.data.saveSession(userId);
  }
  async clear() {
    this.data.session.write(STORAGE_KEYS.session, null);
  }
}
