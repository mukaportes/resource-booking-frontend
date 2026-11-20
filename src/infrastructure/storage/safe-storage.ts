import { z } from 'zod';
import type { DomainError, Result } from '../../domain';
import { reportUnexpected } from '../logger/diagnostics';

export class StorageFault extends Error {
  constructor(readonly domainError: DomainError) {
    super(domainError.message);
  }
}

export function storageError(
  code: DomainError['code'],
  message: string,
  details?: Record<string, unknown>,
): StorageFault {
  return new StorageFault({ code, message, ...(details ? { details } : {}) });
}

export function capture<T>(
  operation: () => T,
  context = 'application.operation',
): Result<T, DomainError> {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    if (error instanceof StorageFault)
      return { ok: false, error: error.domainError };
    const correlationId = reportUnexpected(error, context);
    return {
      ok: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: 'Something went wrong. Please try again.',
        details: { correlationId },
      },
    };
  }
}

export async function captureAsync<T>(
  operation: () => Promise<T>,
  context = 'application.operation',
): Promise<Result<T, DomainError>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return capture(() => {
      throw error;
    }, context);
  }
}

export class SafeStorage {
  constructor(private readonly storage: Storage) {}

  probe() {
    const key = `resourceBooking:probe:${crypto.randomUUID()}`;
    this.write(key, key);
    try {
      if (this.raw(key) !== key)
        throw storageError(
          'STORAGE_UNAVAILABLE',
          'Browser storage probe could not be read.',
        );
    } finally {
      this.write(key, null);
    }
  }

  raw(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      throw storageError(
        'STORAGE_UNAVAILABLE',
        'Browser storage cannot be read.',
      );
    }
  }

  read<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
    const raw = this.raw(key);
    if (raw === null) return fallback;
    try {
      return schema.parse(JSON.parse(raw));
    } catch {
      throw storageError(
        'STORAGE_CORRUPTED',
        'Stored data is invalid. Export it or reset local data.',
        { key },
      );
    }
  }

  write(key: string, value: string | null) {
    try {
      if (value === null) this.storage.removeItem(key);
      else this.storage.setItem(key, value);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error.name === 'QuotaExceededError' ||
          error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
      ) {
        throw storageError(
          'STORAGE_QUOTA_EXCEEDED',
          'Browser storage is full. No changes were saved.',
        );
      }
      throw storageError(
        'STORAGE_UNAVAILABLE',
        'Browser storage cannot be written.',
      );
    }
  }

  commit(entries: ReadonlyArray<readonly [string, string | null]>) {
    const previous = entries.map(([key]) => [key, this.raw(key)] as const);
    let applied = 0;
    try {
      for (const [key, value] of entries) {
        this.write(key, value);
        applied += 1;
      }
    } catch (error) {
      try {
        for (let index = applied - 1; index >= 0; index -= 1) {
          const entry = previous[index];
          if (entry) this.write(entry[0], entry[1]);
        }
      } catch (rollbackError) {
        const correlationId = reportUnexpected(
          rollbackError,
          'storage.rollback',
        );
        throw storageError(
          'STORAGE_CORRUPTED',
          'Saving and rollback both failed. Export local data before resetting.',
          { key: entries[0]?.[0] ?? 'storage', correlationId },
        );
      }
      throw error;
    }
  }
}
