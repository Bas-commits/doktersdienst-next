/**
 * Whether a shift has already ended.
 *
 * `tot` is the unix-seconds end moment from `diensten.tot`, so this comparison is
 * timezone-free. The `currentDate` / `nextDate` strings on a shift block are wall
 * time and would need Amsterdam handling; the epoch does not.
 *
 * Shared by /voorkeuren and POST /api/diensten/preference so the greyed-out block
 * and the rejected request always mean the same thing.
 */
export function hasShiftEnded(tot: number, nowMs: number = Date.now()): boolean {
  return tot * 1000 <= nowMs;
}

/** Shown in the toast when a past shift is rejected, so it is written for doctors, not for logs. */
export const SHIFT_ENDED_MESSAGE =
  'Deze dienst is al voorbij. Voorkeuren kunnen niet meer worden gewijzigd.';

/**
 * Whether a shift (or the part of it being taken over) has already started. Overnames use the start,
 * not the end: once a shift is running the roster and the phone already point at someone.
 */
export function hasShiftStarted(van: number, nowMs: number = Date.now()): boolean {
  return van * 1000 <= nowMs;
}

/**
 * Shown when an overname is refused because the shift has started. Used by /overnames and by
 * POST /api/overnames/propose, whose error the mobile app shows as is.
 */
export const OVERNAME_IN_VERLEDEN_MESSAGE =
  'Het is niet mogelijk om een overname aan te maken voor een dienst in het verleden.';
