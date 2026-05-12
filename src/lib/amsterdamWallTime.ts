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
