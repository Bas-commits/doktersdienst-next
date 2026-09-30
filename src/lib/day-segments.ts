import type { ShiftBlockView } from '@/types/diensten';

// Moved out of CalendarGrid so Rooster Actueel lays out a day the same way the month grid
// does, including night shifts that start the evening before.

/** Pad number to two digits for HH:MM. */
function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Returns blocks that overlap the given calendar day, with the segment of each shift
 * that falls within that day (start/end as "HH:MM" in that day).
 * Used for overnight and multi-day shifts so they render in every day they span.
 */
export function getBlocksWithSegmentsForDay(
  blocks: ShiftBlockView[],
  day: number,
  month0: number,
  year: number
): { block: ShiftBlockView; segmentStartTime: string; segmentEndTime: string }[] {
  const dayStart = new Date(year, month0, day, 0, 0, 0, 0).getTime();
  const dayEnd = new Date(year, month0, day, 23, 59, 59, 999).getTime();
  const result: { block: ShiftBlockView; segmentStartTime: string; segmentEndTime: string }[] = [];

  for (const block of blocks) {
    const startStr = String(block.currentDate).replace(' ', 'T');
    const endStr = String(block.nextDate).replace(' ', 'T');
    const shiftStart = new Date(startStr).getTime();
    const shiftEnd = new Date(endStr).getTime();
    if (Number.isNaN(shiftStart) || Number.isNaN(shiftEnd)) continue;
    if (shiftEnd <= dayStart || shiftStart > dayEnd) continue;

    const segmentStartMs = Math.max(shiftStart, dayStart);
    const segmentEndMs = Math.min(shiftEnd, dayEnd);

    const segStart = new Date(segmentStartMs);
    const segEnd = new Date(segmentEndMs);
    const segmentStartTime = `${pad2(segStart.getHours())}:${pad2(segStart.getMinutes())}`;
    const segmentEndTime =
      segEnd.getHours() === 23 && segEnd.getMinutes() === 59
        ? '24:00'
        : `${pad2(segEnd.getHours())}:${pad2(segEnd.getMinutes())}`;

    result.push({ block, segmentStartTime, segmentEndTime });
  }

  return result;
}

/** Returns true if the block's shift interval overlaps the given calendar day. */
export function blockOverlapsDay(
  block: ShiftBlockView,
  day: number,
  month0: number,
  year: number
): boolean {
  const dayStart = new Date(year, month0, day, 0, 0, 0, 0).getTime();
  const dayEnd = new Date(year, month0, day, 23, 59, 59, 999).getTime();
  const startStr = String(block.currentDate).replace(' ', 'T');
  const endStr = String(block.nextDate).replace(' ', 'T');
  const shiftStart = new Date(startStr).getTime();
  const shiftEnd = new Date(endStr).getTime();
  if (Number.isNaN(shiftStart) || Number.isNaN(shiftEnd)) return false;
  return shiftEnd > dayStart && shiftStart <= dayEnd;
}

/** Previous calendar date (day - 1, handling month/year boundaries). */
export function getPrevDate(day: number, month0: number, year: number): { day: number; month0: number; year: number } {
  const d = new Date(year, month0, day);
  d.setDate(d.getDate() - 1);
  return { day: d.getDate(), month0: d.getMonth(), year: d.getFullYear() };
}

/** Next calendar date (day + 1, handling month/year boundaries). */
export function getNextDate(day: number, month0: number, year: number): { day: number; month0: number; year: number } {
  const d = new Date(year, month0, day);
  d.setDate(d.getDate() + 1);
  return { day: d.getDate(), month0: d.getMonth(), year: d.getFullYear() };
}
