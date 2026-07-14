import { describe, expect, it } from 'vitest';
import { compareCapacity, getCapacityStatus } from './capacity';

describe('capacity traffic lights', () => {
  it('marks adequate coverage green', () => {
    expect(getCapacityStatus(2, 2)).toBe('groen');
    expect(getCapacityStatus(3, 2)).toBe('groen');
    expect(getCapacityStatus(0, 0)).toBe('groen');
  });

  it('marks partial coverage orange and missing coverage red', () => {
    expect(getCapacityStatus(1, 2)).toBe('oranje');
    expect(getCapacityStatus(1, 3)).toBe('rood');
    expect(getCapacityStatus(0, 1)).toBe('rood');
  });

  it('keeps the comparison payload consumable by the overview UI', () => {
    expect(compareCapacity({ key: 'task:2', label: 'Visite', gepland: 1, benodigd: 2 })).toEqual({
      key: 'task:2',
      label: 'Visite',
      gepland: 1,
      benodigd: 2,
      status: 'oranje',
    });
  });
});
