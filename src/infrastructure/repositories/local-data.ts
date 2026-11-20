import { z } from 'zod';
import {
  bookingSchema,
  userSchema,
  type Booking,
  type User,
} from '../../domain';
import { logger } from '../logger';
import { SafeStorage, storageError } from '../storage/safe-storage';

export const STORAGE_KEYS = {
  users: 'resourceBooking:v1:users',
  bookings: 'resourceBooking:v1:bookings',
  sequence: 'resourceBooking:v1:bookingSequence',
  session: 'resourceBooking:v1:session',
} as const;
const version = z.literal(1);
const usersSchema = z
  .object({ schemaVersion: version, items: z.array(userSchema) })
  .strict();
const bookingsSchema = z
  .object({ schemaVersion: version, items: z.array(bookingSchema) })
  .strict();
const sequenceSchema = z
  .object({
    schemaVersion: version,
    lastIssuedId: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
const sessionEnvelopeSchema = z
  .object({
    schemaVersion: version,
    session: z.object({ userId: z.string().uuid() }).strict(),
  })
  .strict();
const envelope = <T>(items: T[]) => JSON.stringify({ schemaVersion: 1, items });

export interface Snapshot {
  users: User[];
  bookings: Booking[];
  lastIssuedId: number;
}

export class LocalData {
  readonly local: SafeStorage;
  readonly session: SafeStorage;
  constructor(localStorage: Storage, sessionStorage: Storage) {
    this.local = new SafeStorage(localStorage);
    this.session = new SafeStorage(sessionStorage);
  }

  read(recoverSequence = false): Snapshot {
    const users = this.local.read(STORAGE_KEYS.users, usersSchema, {
      schemaVersion: 1,
      items: [],
    }).items;
    const bookings = this.local.read(STORAGE_KEYS.bookings, bookingsSchema, {
      schemaVersion: 1,
      items: [],
    }).items;
    const maxId = bookings.reduce(
      (max, booking) => Math.max(max, booking.id),
      0,
    );
    const missingSequence = this.local.raw(STORAGE_KEYS.sequence) === null;
    const lastIssuedId = this.local.read(
      STORAGE_KEYS.sequence,
      sequenceSchema,
      { schemaVersion: 1, lastIssuedId: maxId },
    ).lastIssuedId;
    if (lastIssuedId < maxId) this.corrupted(STORAGE_KEYS.sequence);
    if (
      new Set(users.map((user) => user.userId)).size !== users.length ||
      new Set(users.map((user) => user.email)).size !== users.length
    )
      this.corrupted(STORAGE_KEYS.users);
    if (
      new Set(bookings.map((booking) => booking.id)).size !== bookings.length ||
      bookings.some(
        (booking) => !users.some((user) => user.userId === booking.userId),
      )
    )
      this.corrupted(STORAGE_KEYS.bookings);
    if (recoverSequence && missingSequence && bookings.length > 0) {
      logger.warn(
        'Missing booking sequence recovered from existing booking IDs',
      );
      this.local.write(
        STORAGE_KEYS.sequence,
        JSON.stringify({ schemaVersion: 1, lastIssuedId }),
      );
    }
    return { users, bookings, lastIssuedId };
  }

  private corrupted(key: string): never {
    throw storageError(
      'STORAGE_CORRUPTED',
      'Stored records are inconsistent. Export them or reset local data.',
      { key },
    );
  }

  sessionUserId(): string | null {
    return (
      this.session.read(
        STORAGE_KEYS.session,
        sessionEnvelopeSchema.nullable(),
        null,
      )?.session.userId ?? null
    );
  }

  currentUser(users: User[]): { user: User | null; sessionReset: boolean } {
    const value = this.session.read(
      STORAGE_KEYS.session,
      sessionEnvelopeSchema.nullable(),
      null,
    );
    if (!value) return { user: null, sessionReset: false };
    const user = users.find(
      (candidate) => candidate.userId === value.session.userId,
    );
    if (user) return { user, sessionReset: false };
    this.session.write(STORAGE_KEYS.session, null);
    return { user: null, sessionReset: true };
  }

  saveUsers(users: User[]) {
    this.local.write(STORAGE_KEYS.users, envelope(users));
  }
  saveSession(userId: string) {
    this.session.write(
      STORAGE_KEYS.session,
      JSON.stringify({ schemaVersion: 1, session: { userId } }),
    );
  }
  saveBookings(bookings: Booking[], lastIssuedId: number) {
    this.local.commit([
      [STORAGE_KEYS.bookings, envelope(bookings)],
      [
        STORAGE_KEYS.sequence,
        JSON.stringify({ schemaVersion: 1, lastIssuedId }),
      ],
    ]);
  }

  exportRawData(): string {
    return JSON.stringify(
      {
        [STORAGE_KEYS.users]: this.local.raw(STORAGE_KEYS.users),
        [STORAGE_KEYS.bookings]: this.local.raw(STORAGE_KEYS.bookings),
        [STORAGE_KEYS.sequence]: this.local.raw(STORAGE_KEYS.sequence),
        [STORAGE_KEYS.session]: this.session.raw(STORAGE_KEYS.session),
      },
      null,
      2,
    );
  }

  reset() {
    const previousSession = this.session.raw(STORAGE_KEYS.session);
    this.session.write(STORAGE_KEYS.session, null);
    try {
      this.local.commit([
        [STORAGE_KEYS.users, null],
        [STORAGE_KEYS.bookings, null],
        [STORAGE_KEYS.sequence, null],
      ]);
    } catch (error) {
      this.session.write(STORAGE_KEYS.session, previousSession);
      throw error;
    }
  }
}
