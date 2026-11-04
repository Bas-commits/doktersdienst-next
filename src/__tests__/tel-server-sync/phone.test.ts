import { describe, expect, it } from 'vitest';
import { getTelnr } from '@/tel-server-sync/phone';

describe('getTelnr', () => {
  it('normalizes Dutch local and international phone numbers like legacy PHP', () => {
    expect(getTelnr('06 12-34-56-78')).toBe('31612345678');
    expect(getTelnr('+31 6 12 34 56 78')).toBe('31612345678');
    expect(getTelnr('0031 6 12 34 56 78')).toBe('31612345678');
  });

  it('rejects values with misplaced plus signs or too few characters', () => {
    expect(getTelnr('1+234')).toBe(false);
    expect(getTelnr('12')).toBe(false);
  });

  it('strips non-phone characters without changing already normalized numbers', () => {
    expect(getTelnr('(31880026406)')).toBe('31880026406');
  });
});
