import { describe, expect, it, vi } from 'vitest';
import { capture } from './storage/safe-storage';

describe('unexpected failure diagnostics', () => {
  it('links a user reference to sanitized cause and operation evidence', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new TypeError(
      'owner@example.com {"startAt":123,"userId":"private"}',
    );
    error.stack =
      'TypeError: owner@example.com\n    at saveBooking (http://localhost/assets/booking.js?owner=owner@example.com:12:4)\n    at commit (http://localhost/assets/storage.js:20:8)';
    const result = capture(() => {
      throw error;
    }, 'booking.create');
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'UNEXPECTED_ERROR' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    const id = result.error.details?.correlationId;
    expect(log).toHaveBeenCalledWith(
      `[resource-booking:${id}] Unexpected application failure`,
      expect.objectContaining({
        type: 'TypeError',
        operation: 'booking.create',
        stack: 'storage.js:20:8',
      }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /owner@example|startAt|private/,
    );
    log.mockRestore();
  });
});
