import type { ShiftBlockView } from '@/types/diensten';
import {
  blockOverlapsDay,
  getBlocksWithSegmentsForDay,
  getNextDate,
  getPrevDate,
} from '@/lib/day-segments';

/**
 * Rooster Actueel: one day, one row per waarneemgroep of the viewer.
 *
 * The old system's "Actuele diensten" listed the groups the logged-in doctor belongs to. The
 * card first spoke of an umbrella group, but the screenshot of the old page shows two groups
 * from different regions that exactly three doctors share, so "own groups" is the rule. The
 * groups come from the same list as the header (own groups; all active groups for an
 * administrator), and /api/diensten enforces the same membership on the server.
 */

/**
 * A weekend shift runs from Friday evening to Monday morning, and /api/diensten only returns
 * diensten that lie entirely inside the window (van >= vanGte and tot <= totLte). Fetching just
 * the day itself would drop every shift that started before midnight or ends after it.
 */
const VENSTER_MARGE_SECONDEN = 4 * 24 * 60 * 60;

export type RoosterActueelGroep = {
  id: number;
  naam: string;
  telnronzecentrale: string | null;
};

export type RoosterActueelSegment = {
  block: ShiftBlockView;
  segmentStartTime: string;
  segmentEndTime: string;
  continuesFromPrev: boolean;
  continuesToNext: boolean;
};

export type RoosterActueelRij = RoosterActueelGroep & { segments: RoosterActueelSegment[] };

/** Fetch window for one day: the day itself plus enough margin for shifts that span it. */
export function roosterActueelVenster(dag: Date): { vanGte: number; totLte: number } {
  const begin = new Date(dag.getFullYear(), dag.getMonth(), dag.getDate(), 0, 0, 0, 0);
  const eind = new Date(dag.getFullYear(), dag.getMonth(), dag.getDate(), 23, 59, 59, 999);
  return {
    vanGte: Math.floor(begin.getTime() / 1000) - VENSTER_MARGE_SECONDEN,
    totLte: Math.floor(eind.getTime() / 1000) + VENSTER_MARGE_SECONDEN,
  };
}

/**
 * One row per group with at least one shift on `dag`, open slots included, because an open slot
 * is exactly the gap this screen should show. Groups without a shift that day get no row.
 *
 * Returns the rows in the order of `groepen`, each with the part of every shift that falls on
 * `dag`.
 */
export function roosterActueelRijen(
  blocks: ShiftBlockView[],
  groepen: RoosterActueelGroep[],
  dag: Date,
): RoosterActueelRij[] {
  const day = dag.getDate();
  const month0 = dag.getMonth();
  const year = dag.getFullYear();
  const prev = getPrevDate(day, month0, year);
  const next = getNextDate(day, month0, year);

  const perGroep = new Map<number, ShiftBlockView[]>();
  for (const block of blocks) {
    const id = block.idwaarneemgroep;
    if (id == null) continue;
    const lijst = perGroep.get(id);
    if (lijst) lijst.push(block);
    else perGroep.set(id, [block]);
  }

  const rijen: RoosterActueelRij[] = [];
  for (const groep of groepen) {
    const segments = getBlocksWithSegmentsForDay(perGroep.get(groep.id) ?? [], day, month0, year)
      .map(({ block, segmentStartTime, segmentEndTime }) => ({
        block,
        segmentStartTime,
        segmentEndTime,
        continuesFromPrev: blockOverlapsDay(block, prev.day, prev.month0, prev.year),
        continuesToNext: blockOverlapsDay(block, next.day, next.month0, next.year),
      }))
      .sort((a, b) => a.block.van - b.block.van);
    if (segments.length > 0) rijen.push({ ...groep, segments });
  }
  return rijen;
}

/** Position of `moment` on the 00:00–24:00 axis of `dag` as a percentage, or null on another day. */
export function nuPositiePercentage(dag: Date, moment: Date): number | null {
  const begin = new Date(dag.getFullYear(), dag.getMonth(), dag.getDate()).getTime();
  const volgende = new Date(dag.getFullYear(), dag.getMonth(), dag.getDate() + 1).getTime();
  const t = moment.getTime();
  if (t < begin || t >= volgende) return null;
  return ((t - begin) / (volgende - begin)) * 100;
}
