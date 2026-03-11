import type { WeekDateRangeItem } from '../types/rooster';

/** ISO week number for a date (Monday = start of week) */
export function getWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
}

/** Number of week rows (Mon–Sun) needed to show every day of the month. */
export function monthWeekCount(year: number, month: number): number {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const lastDate = lastOfMonth.getDate();
  const offset = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  return Math.ceil((lastDate + offset) / 7);
}

/** Returns the 7 days (Mon–Sun) for the given ISO week number and year. Ported from rooster-calendar.js */
export function getDateRangeOfWeek(weekNo: number, currentYear: number): WeekDateRangeItem[] {
  const result: WeekDateRangeItem[] = [];
  const d1 = new Date();
  d1.setFullYear(currentYear);
  const numOfdaysPastSinceLastMonday = d1.getDay() - 1;
  d1.setDate(d1.getDate() - numOfdaysPastSinceLastMonday);
  const weekNoToday = getWeek(d1);
  const weeksInTheFuture = weekNo - weekNoToday;
  d1.setDate(d1.getDate() + 7 * weeksInTheFuture);

  for (let i = 0; i < 7; i++) {
    const m = d1.getMonth() + 1;
    const day = d1.getDate();
    const y = d1.getFullYear();
    const getFullDate =
      y +
      '-' +
      (m < 10 ? '0' + m : String(m)) +
      '-' +
      (day < 10 ? '0' + day : String(day));
    const DateDDMMYYYY =
      (day < 10 ? '0' + day : String(day)) +
      '-' +
      (m < 10 ? '0' + m : String(m)) +
      '-' +
      y;
    result.push({
      Date: getFullDate,
      DateDDMMYYYY,
      Day: day,
      Month: d1.getMonth(),
      Year: y,
    });
    d1.setDate(d1.getDate() + 1);
  }
  return result;
}

/** ISO week number and week-year for a date string "YYYY-MM-DD" (parsed as local date). */
export function getWeekNumber(dateString: string): { year: number; week: number } {
  const parts = dateString.split(/[-/]/).map(Number);
  const y = parts[0];
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const date = new Date(y, m - 1, d);
  const week = getWeek(date);
  const dayNr = (date.getDay() + 6) % 7;
  const thursday = new Date(date);
  thursday.setDate(date.getDate() - dayNr + 3);
  const year = thursday.getFullYear();
  return { year, week };
}

export const MONTH_SHORT: string[] = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

export const MONTH_LONG: string[] = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
];

export const WEEKDAY_LABELS: string[] = [
  'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag',
];
