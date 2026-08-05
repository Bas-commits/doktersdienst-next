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
