import { describe, it, expect } from 'vitest';
import { getWeek, getWeekNumber } from '../calendarUtils';

describe('getWeek', () => {
  it('returns ISO week number for a given date', () => {
    expect(getWeek(new Date(2026, 0, 1))).toBe(1);
    expect(getWeek(new Date(2026, 0, 5))).toBe(2);
    expect(getWeek(new Date(2026, 0, 26))).toBe(5);
    expect(getWeek(new Date(2026, 1, 2))).toBe(6);
  });
});

describe('getWeekNumber', () => {
  it('returns ISO week and year for YYYY-MM-DD (local date)', () => {
    expect(getWeekNumber('2026-01-01')).toEqual({ year: 2026, week: 1 });
    expect(getWeekNumber('2026-01-26')).toEqual({ year: 2026, week: 5 });
    expect(getWeekNumber('2026-02-02')).toEqual({ year: 2026, week: 6 });
  });

  it('returns correct week-year when week spans two years', () => {
    expect(getWeekNumber('2026-12-28')).toEqual({ year: 2026, week: 53 });
    expect(getWeekNumber('2027-01-01')).toEqual({ year: 2026, week: 53 });
  });
});
