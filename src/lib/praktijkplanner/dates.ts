export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parsePositiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseNonNegativeInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function formatIsoDate(date: Date): string {
  // Het jaar wordt net als maand en dag aangevuld tot vier cijfers. Een datumveld levert
  // tijdens het typen tussenstanden als jaar 2 of 202 op; zonder aanvulling werd daar
  // "2-08-24" van gemaakt, wat geen ISO-datum is en verderop een ongeldige datum oplevert.
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, days: number): string {
  const value = new Date(`${isoDate}T12:00:00`);
  value.setDate(value.getDate() + days);
  return formatIsoDate(value);
}

export function startOfIsoWeek(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - weekday + 1);
  return formatIsoDate(date);
}

export function endOfIsoWeek(isoDate: string): string {
  return addDays(startOfIsoWeek(isoDate), 6);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function weekRangeLabel(weekStart: string, options: { withYear?: boolean } = {}): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${addDays(weekStart, 6)}T12:00:00`);
  // Een label hoort de planner nooit onderuit te halen. Intl gooit op een ongeldige datum,
  // en die kwam hier binnen via een half ingetypte datum in de herhaal popup.
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';

  const dayFormatter = new Intl.DateTimeFormat('nl-NL', { day: 'numeric' });
  const monthFormatter = new Intl.DateTimeFormat('nl-NL', { month: 'short' });

  const formatMonth = (date: Date) => monthFormatter.format(date).replace('.', '');
  // The year of the last day, so a week crossing new year reads "29 dec - 4 jan 2027".
  const yearSuffix = options.withYear ? ` ${end.getFullYear()}` : '';

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${dayFormatter.format(start)} – ${dayFormatter.format(end)} ${formatMonth(start)}${yearSuffix}`;
  }

  return `${dayFormatter.format(start)} ${formatMonth(start)} – ${dayFormatter.format(end)} ${formatMonth(end)}${yearSuffix}`;
}

export function monthBounds(year: number, monthOneBased: number): { start: string; end: string } | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(monthOneBased) || monthOneBased < 1 || monthOneBased > 12) return null;
  const start = new Date(year, monthOneBased - 1, 1, 12);
  const end = new Date(year, monthOneBased, 0, 12);
  return { start: formatIsoDate(start), end: formatIsoDate(end) };
}

/**
 * Returns the complete Monday-to-Sunday calendar range that contains a month.
 * The legacy absence planner renders its leading and trailing calendar days too,
 * so their slots must be loaded alongside the selected month.
 */
export function monthCalendarBounds(year: number, monthOneBased: number): { start: string; end: string } | null {
  const bounds = monthBounds(year, monthOneBased);
  if (!bounds) return null;

  const start = startOfIsoWeek(bounds.start);
  const daysUntilSunday = 7 - weekdayFromIsoDate(bounds.end);
  return { start, end: addDays(bounds.end, daysUntilSunday) };
}

export function weekdayFromIsoDate(isoDate: string): number {
  const day = new Date(`${isoDate}T12:00:00`).getDay();
  return day === 0 ? 7 : day;
}

export function datesBetweenInclusive(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function isDateRange(value: { start?: unknown; end?: unknown }): value is { start: string; end: string } {
  return isIsoDate(value.start) && isIsoDate(value.end) && value.start <= value.end;
}
