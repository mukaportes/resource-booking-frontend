import type { Booking } from './types';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_EMAIL'
  | 'INVALID_INPUT'
  | 'RESOURCE_NOT_FOUND'
  | 'INVALID_INTERVAL'
  | 'OFF_GRID_TIME'
  | 'START_IN_PAST'
  | 'TIME_SLOT_CONFLICT'
  | 'BOOKING_NOT_FOUND'
  | 'NOT_BOOKING_OWNER'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'STORAGE_CORRUPTED'
  | 'UNEXPECTED_ERROR';

export interface ErrorDetails {
  conflicts?: Booking[];
  fields?: string[];
  [key: string]: unknown;
}
export interface DomainError {
  code: ErrorCode;
  message: string;
  details?: ErrorDetails;
}
export type Result<T, E = DomainError> =
  { ok: true; value: T } | { ok: false; error: E };

export function success<T>(value: T): Result<T, never> {
  return { ok: true, value };
}
export function failure<T = never>(
  code: ErrorCode,
  message: string,
  details?: ErrorDetails,
): Result<T> {
  return {
    ok: false,
    error: { code, message, ...(details ? { details } : {}) },
  };
}
