import { TZDate } from '@date-fns/tz';

/** IANA zone for business datetimes (matches DB + legacy PHP convention). */
export const APP_TIME_ZONE = 'Europe/Amsterdam';

const WALL_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/**
 * Parses "YYYY-MM-DD HH:MM:SS" as a wall-clock instant in {@link APP_TIME_ZONE} and returns Unix seconds.
 * Use this for API bodies where the client sends naive local strings (e.g. shift Van/Tot from the admin form).
 */
export function parseAmsterdamWallDateTimeToUnixSeconds(s: string): number | null {
  const m = WALL_RE.exec(s.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month0 = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hours = Number(m[4]);
  const minutes = Number(m[5]);
  const seconds = Number(m[6]);
  if ([year, month0, day, hours, minutes, seconds].some((n) => Number.isNaN(n))) return null;

  const d = new TZDate(year, month0, day, hours, minutes, seconds, APP_TIME_ZONE);
  const ms = d.getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

/**
 * Formatters are built once: constructing an Intl.DateTimeFormat per row is the
 * expensive part, and these are called in a loop over every pending overname.
 * hourCycle 'h23' keeps midnight as 00:00 rather than the 24:00 some locales emit.
 */
const AMSTERDAM_TIME = new Intl.DateTimeFormat('nl-NL', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: APP_TIME_ZONE,
});

const AMSTERDAM_DATE_LABEL = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: APP_TIME_ZONE,
});

/**
 * Formats Unix seconds as "HH:MM" in {@link APP_TIME_ZONE}.
 *
 * Server code must not reach for `Date#getHours` on a business time. That reads the
 * host's zone, which is Europe/Amsterdam on a developer machine and UTC in the
 * deployed container, so the same shift renders two hours apart depending on where
 * the code happens to run — and only ever looks wrong in production.
 */
export function formatAmsterdamTimeFromUnixSeconds(unixSeconds: number): string {
  return AMSTERDAM_TIME.format(new Date(unixSeconds * 1000));
}

/**
 * Formats Unix seconds as a Dutch long date ("donderdag 13 augustus") in
 * {@link APP_TIME_ZONE}. Same hazard as the time formatter above: a shift starting
 * shortly after midnight lands on the previous day when formatted in UTC.
 */
export function formatAmsterdamDateLabelFromUnixSeconds(unixSeconds: number): string {
  return AMSTERDAM_DATE_LABEL.format(new Date(unixSeconds * 1000));
}
