import { describe, expect, it } from 'vitest';
import {
  defaultBookingStart,
  nextSlot,
  toDateInput,
  toEpochMs,
  toTimeInput,
  visibleScheduleRange,
} from './time';

describe('local time boundary', () => {
  it('rejects calendar normalization and invalid inputs without inventing an instant', () => {
    expect(toEpochMs('2027-02-30', '09:00')).toBeNaN();
    expect(toEpochMs('2027-01-12', '24:00')).toBeNaN();
    expect(toEpochMs('', '')).toBeNaN();
  });
  it('round trips local fields into numeric epochs', () => {
    const value = toEpochMs('2027-01-12', '09:00');
    expect(typeof value).toBe('number');
    expect(toDateInput(value)).toBe('2027-01-12');
    expect(toTimeInput(value)).toBe('09:00');
  });
  it('retains future date context, rounds today forward and refuses past defaults', () => {
    const now = toEpochMs('2027-01-11', '08:01');
    expect(defaultBookingStart('2027-01-11', now)).toBe(nextSlot(now));
    expect(toDateInput(defaultBookingStart('2027-01-12', now)!)).toBe(
      '2027-01-12',
    );
    expect(defaultBookingStart('2027-01-10', now)).toBeNull();
  });
  it('provides local day and Monday week intervals with exclusive ends', () => {
    expect(visibleScheduleRange('2027-01-12', 'week')).toEqual({
      from: toEpochMs('2027-01-11', '00:00'),
      to: toEpochMs('2027-01-18', '00:00'),
    });
    expect(visibleScheduleRange('2027-01-12', 'day')).toEqual({
      from: toEpochMs('2027-01-12', '00:00'),
      to: toEpochMs('2027-01-13', '00:00'),
    });
  });
});
