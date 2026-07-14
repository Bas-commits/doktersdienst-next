import { describe, expect, it } from 'vitest';
import {
  addDays,
  datesBetweenInclusive,
  isIsoDate,
  monthCalendarBounds,
  monthBounds,
  startOfIsoWeek,
  weekRangeLabel,
  weeksOverlappingMonth,
  weekdayFromIsoDate,
} from './dates';

describe('Praktijkplanner date helpers', () => {
  it('uses Monday as the ISO week start', () => {
    expect(startOfIsoWeek('2026-07-14')).toBe('2026-07-13');
    expect(startOfIsoWeek('2026-07-12')).toBe('2026-07-06');
  });

  it('preserves calendar dates across month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(datesBetweenInclusive('2026-02-27', '2026-03-01')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
  });

  it('validates date input and calendar bounds', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(monthBounds(2028, 2)).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthCalendarBounds(2026, 7)).toEqual({ start: '2026-06-29', end: '2026-08-02' });
    expect(weekdayFromIsoDate('2026-07-12')).toBe(7);
  });

  it('lists ISO weeks overlapping a month and formats week labels', () => {
    expect(weeksOverlappingMonth(2026, 7)).toEqual([
      '2026-06-29',
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
      '2026-07-27',
    ]);
    expect(weekRangeLabel('2026-07-13')).toBe('13 – 19 jul');
    expect(weekRangeLabel('2026-06-29')).toBe('29 jun – 5 jul');
  });
});
