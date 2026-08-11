import { describe, expect, it } from 'vitest';
import {
  addDays,
  datesBetweenInclusive,
  formatIsoDate,
  isIsoDate,
  isoWeekNumber,
  maandVanWeek,
  monthCalendarBounds,
  monthBounds,
  startOfIsoWeek,
  weekRangeLabel,
  weekVanMaand,
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

  it('formats week labels', () => {
    expect(weekRangeLabel('2026-07-13')).toBe('13 – 19 jul');
    expect(weekRangeLabel('2026-06-29')).toBe('29 jun – 5 jul');
  });

  it('pads the year so a half-typed date stays an ISO date', () => {
    expect(formatIsoDate(new Date('0002-08-24T12:00:00'))).toBe('0002-08-24');
    expect(isIsoDate(startOfIsoWeek('0002-08-24'))).toBe(true);
    expect(weekRangeLabel('not-a-date')).toBe('');
  });

  it('adds the year of the last day when asked', () => {
    expect(weekRangeLabel('2026-07-13', { withYear: true })).toBe('13 – 19 jul 2026');
    expect(weekRangeLabel('2026-06-29', { withYear: true })).toBe('29 jun – 5 jul 2026');
    expect(weekRangeLabel('2026-12-28', { withYear: true })).toBe('28 dec – 3 jan 2027');
  });
});

describe('isoWeekNumber', () => {
  it('telt de week waarin de donderdag valt', () => {
    expect(isoWeekNumber('2026-08-10')).toBe(33);
    expect(isoWeekNumber('2026-08-16')).toBe(33);
    expect(isoWeekNumber('2026-08-17')).toBe(34);
  });

  it('rekent de jaarwisseling naar het jaar van de donderdag', () => {
    // 1 januari 2027 is een vrijdag, dus die dag hoort nog bij week 53 van 2026.
    expect(isoWeekNumber('2027-01-01')).toBe(53);
    expect(isoWeekNumber('2027-01-04')).toBe(1);
    // 1 januari 2026 is een donderdag en begint dus wel gewoon week 1.
    expect(isoWeekNumber('2026-01-01')).toBe(1);
  });

  it('kiest voor de maand van een week de maand van de donderdag', () => {
    // Week 31 aug t/m 6 sep: de donderdag is 3 september, dus september.
    expect(maandVanWeek('2026-08-31')).toEqual({ year: 2026, month: 9 });
    expect(maandVanWeek('2026-08-10')).toEqual({ year: 2026, month: 8 });
    // Week 28 dec 2026 t/m 3 jan 2027: donderdag 31 december, dus nog 2026.
    expect(maandVanWeek('2026-12-28')).toEqual({ year: 2026, month: 12 });
  });

  it('geeft van een maand een week terug die in die maand valt', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(maandVanWeek(weekVanMaand(2026, month))).toEqual({ year: 2026, month });
    }
    // Ook als de 1e nog in de laatste week van de vorige maand ligt: 1 nov 2026 is een zondag.
    expect(weekVanMaand(2026, 11)).toBe('2026-11-02');
  });
});
