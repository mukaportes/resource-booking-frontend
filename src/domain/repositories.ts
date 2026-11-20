import type { Result } from './errors';
import type {
  AvailabilityResult,
  Booking,
  BookingStatus,
  CancelResult,
  CreateBookingInput,
  ResourceId,
  User,
} from './types';

export interface BookingFilter {
  resourceIds?: ResourceId[];
  from?: number;
  to?: number;
  status?: BookingStatus[];
}

export interface BookingRepository {
  list(filter: BookingFilter): Promise<Booking[]>;
  getById(id: number): Promise<Booking | undefined>;
  create(input: CreateBookingInput, userId: string): Promise<Result<Booking>>;
  cancel(id: number, userId: string): Promise<Result<CancelResult>>;
  checkAvailability(
    resourceId: ResourceId,
    startAt: number,
    endAt: number,
  ): Promise<Result<AvailabilityResult>>;
}

export interface UserRepository {
  list(): Promise<User[]>;
  identify(normalizedEmail: string): Promise<User>;
}

export interface SessionStore {
  getUserId(): Promise<string | null>;
  setUserId(userId: string): Promise<void>;
  clear(): Promise<void>;
}
