import { describe, expect, it } from 'vitest';
import { RESOURCES } from '../../domain';
import { readViewState, writeViewState } from './view-state';

describe('shared view URLs', () => {
  it('defaults to all resources and responsive view only when no view is supplied', () => {
    expect(readViewState('', false).state.view).toBe('week');
    expect(readViewState('', true).state.view).toBe('day');
    expect(readViewState('?view=week', true).state.view).toBe('week');
    expect(readViewState('').state.resourceIds).toEqual(
      RESOURCES.map((resource) => resource.id),
    );
  });
  it('preserves an intentional empty selection and drops only unknown resource IDs', () => {
    expect(readViewState('?resources=').state.resourceIds).toEqual([]);
    const parsed = readViewState('?resources=room-1,missing,room-1,tablet-2');
    expect(parsed.state.resourceIds).toEqual(['room-1', 'tablet-2']);
    expect(parsed.unknownResources).toEqual(['missing']);
  });
  it('rejects normalized impossible local dates', () => {
    const now = new Date(2027, 0, 12, 12);
    expect(readViewState('?date=2027-02-30', false, now).state.date).toBe(
      '2027-01-12',
    );
    expect(readViewState('?date=2027-02-28', false, now).state.date).toBe(
      '2027-02-28',
    );
  });
  it('round trips all filters and keeps unrelated URL parameters', () => {
    const state = readViewState(
      '?view=list&date=2027-01-12&resources=tablet-1&showCancelled=1&scope=mine',
    ).state;
    const url = writeViewState(state, '?campaign=shared');
    expect(url).toContain('campaign=shared');
    expect(readViewState(url).state).toEqual(state);
    expect(
      writeViewState({ ...state, mine: false, showCancelled: false }),
    ).not.toMatch(/scope|showCancelled/);
  });
});
