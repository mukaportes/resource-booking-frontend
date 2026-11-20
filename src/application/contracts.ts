import type {
  AvailabilityResult,
  Booking,
  CancelResult,
  Result,
  User,
} from '../domain';
import type { BookingFilter } from '../domain';
export type { BookingFilter } from '../domain';

export interface BookingApplication {
  initialize(): Promise<
    Result<{ user: User | null; sessionReset: boolean; readOnly?: boolean }>
  >;
  login(email: unknown): Promise<Result<User>>;
  logout(): Promise<Result<void>>;
  getCurrentUser(): Promise<Result<User | null>>;
  getUsers(): Promise<Result<User[]>>;
  listBookings(filter?: BookingFilter): Promise<Result<Booking[]>>;
  createBooking(input: unknown): Promise<Result<Booking>>;
  cancelBooking(id: number): Promise<Result<CancelResult>>;
  checkAvailability(
    resourceId: unknown,
    startAt: unknown,
    endAt: unknown,
  ): Promise<Result<AvailabilityResult>>;
  subscribe(listener: () => void): () => void;
  exportRawData(): Promise<Result<string>>;
  resetLocalData(confirmation: string): Promise<Result<void>>;
}
