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
  readOnly = false;
  private recoveredSession: string | null = null;
  private sessionReset = false;
  private cached: { raw: (string | null)[]; snapshot: Snapshot } | null = null;

  assertWritable() {
    if (this.readOnly)
      throw storageError(
        'STORAGE_QUOTA_EXCEEDED',
        'Storage is full. Export your data, free site storage capacity, then retry storage. The workspace is read-only.',
      );
  }
  constructor(localStorage: Storage, sessionStorage: Storage) {
    this.local = new SafeStorage(localStorage);
    this.session = new SafeStorage(sessionStorage);
  }

  read(recoverSequence = false): Snapshot {
    // Compare raw values even on command reads: other tabs can change storage before events arrive.
    const raw = [
      STORAGE_KEYS.users,
      STORAGE_KEYS.bookings,
      STORAGE_KEYS.sequence,
    ].map((key) => this.local.raw(key));
    if (
      this.cached &&
      raw.every((value, index) => value === this.cached?.raw[index]) &&
      (!recoverSequence ||
        raw[2] !== null ||
        this.cached.snapshot.bookings.length === 0)
    )
      return this.cached.snapshot;
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
    const userIds = new Set(users.map((user) => user.userId));
    if (
      userIds.size !== users.length ||
      new Set(users.map((user) => user.email)).size !== users.length
    )
      this.corrupted(STORAGE_KEYS.users);
    if (
      new Set(bookings.map((booking) => booking.id)).size !== bookings.length ||
      bookings.some((booking) => !userIds.has(booking.userId))
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
    const snapshot = { users, bookings, lastIssuedId };
    this.cached = { raw, snapshot };
    return snapshot;
  }

  private corrupted(key: string): never {
    throw storageError(
      'STORAGE_CORRUPTED',
      'Stored records are inconsistent. Export them or reset local data.',
      { key },
    );
  }

  sessionUserId(): string | null {
    const raw = this.session.raw(STORAGE_KEYS.session);
    if (raw === null) return null;
    try {
      return sessionEnvelopeSchema.parse(JSON.parse(raw)).session.userId;
    } catch {
      this.recoveredSession = raw;
      if (!this.readOnly) this.session.write(STORAGE_KEYS.session, null);
      this.sessionReset = true;
      return null;
    }
  }

  currentUser(users: User[]): { user: User | null; sessionReset: boolean } {
    const userId = this.sessionUserId();
    if (userId === null) {
      const sessionReset = this.sessionReset;
      this.sessionReset = false;
      return { user: null, sessionReset };
    }
    const user = users.find((candidate) => candidate.userId === userId);
    if (user) return { user, sessionReset: false };
    if (!this.readOnly) this.session.write(STORAGE_KEYS.session, null);
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
        [STORAGE_KEYS.session]:
          this.recoveredSession ?? this.session.raw(STORAGE_KEYS.session),
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
