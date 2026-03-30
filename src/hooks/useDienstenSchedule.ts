import { useMemo } from 'react';
import type { DienstenResponse, ShiftBlockView, Dienst, DienstDeelnemer, DoctorInfo } from '@/types/diensten';
import type { CalendarGridRow } from '@/components/CalandarGrid/CalendarGrid';

function formatTwoDigits(n: number): string {
  return n.toString().padStart(2, '0');
}

/** True if [aVan, aTot] and [bVan, bTot] overlap (half-open-style boundary check matches PHP shift overlap). */
export function intervalsOverlap(aVan: number, aTot: number, bVan: number, bTot: number): boolean {
  return aVan < bTot && aTot > bVan;
}

export function toDoctorInfo(dienst: Dienst): DoctorInfo | null {
  const d = dienst.diensten_deelnemers;
  if (!d) return null;
  return toDoctorInfoFromDeelnemer(d);
}

export function toDoctorInfoFromDeelnemer(d: DienstDeelnemer): DoctorInfo {
  const fullName = `${d.voornaam} ${d.achternaam}`.trim();
  const shortName =
    (d.voornaam?.[0] ?? '').toUpperCase() + (d.achternaam?.[0] ?? '').toUpperCase();
  return {
    id: d.id,
    name: fullName || `Doctor ${d.id}`,
    shortName: shortName || `#${d.id}`,
    color: d.color || '#c686fd',
  };
}

/**
 * Converts a list of diensten (each with one participant, e.g. from voorkeuren subscription)
 * into one ShiftBlockView per dienst. Use for "my diensten" views where each dienst
 * is a single assigned shift (types 2, 3, 9, 10, 5001).
 */
export function dienstenToShiftBlocksFromParticipant(
  response: DienstenResponse | null | undefined
): ShiftBlockView[] {
  if (!response?.data?.diensten?.length) return [];
  const blocks: ShiftBlockView[] = [];
  for (const dienst of response.data.diensten) {
    const start = new Date(dienst.van * 1000);
    const end = new Date(dienst.tot * 1000);
    const day = start.getDate();
    const month0 = start.getMonth();
    const year = start.getFullYear();
    const startTime = `${formatTwoDigits(start.getHours())}:${formatTwoDigits(start.getMinutes())}`;
    const endTime = `${formatTwoDigits(end.getHours())}:${formatTwoDigits(end.getMinutes())}`;
    const currentDate = `${start.getFullYear()}-${formatTwoDigits(
      start.getMonth() + 1
    )}-${formatTwoDigits(start.getDate())} ${startTime}:00`;
    const nextDate = `${end.getFullYear()}-${formatTwoDigits(
      end.getMonth() + 1
    )}-${formatTwoDigits(end.getDate())} ${endTime}:00`;
    const middle = toDoctorInfo(dienst);
    blocks.push({
      id: dienst.id,
      day,
      month: month0,
      year,
      van: dienst.van,
      tot: dienst.tot,
      startTime,
      endTime,
      currentDate,
      nextDate,
      middle: middle ?? null,
      top: null,
      bottom: null,
      idwaarneemgroep: dienst.idwaarneemgroep,
    });
  }
  return blocks;
}

/** Returns the overnameType for a dienst based on its type and status, or undefined for non-overname records. */
function getOvernameType(dienst: Dienst): ShiftBlockView['overnameType'] {
  if (!dienst.status) return undefined;
  if (dienst.type === 4 && dienst.status === 'pending') return 'voorstelOvername';
  if (dienst.type === 4 && dienst.status === 'declined') return 'vraagtekenOvername';
  if (dienst.type === 6 && dienst.status === 'accepted') return 'overname';
  return undefined;
}

/** Pure transformer: converts diensten API response into flat ShiftBlockView list. */
export function dienstenToShiftBlocks(response: DienstenResponse | null | undefined): ShiftBlockView[] {
  if (!response?.data?.diensten?.length) return [];

  // 0/4/6=Standaard (legacy PHP uses 4 and 6 alongside 0), 1=slot, 5=Achterwacht, 9=Extra Dokter, 11=deprecated (old Next) still merged into bottom
  const relevantTypes = new Set<number>([0, 1, 4, 5, 6, 9, 11]);
  const byKey = new Map<string, { base: Dienst | null; items: Dienst[] }>();
  const overnameRecords: Dienst[] = [];

  for (const dienst of response.data.diensten) {
    if (!relevantTypes.has(dienst.type)) continue;
    if (getOvernameType(dienst)) {
      overnameRecords.push(dienst);
      continue;
    }
    const start = new Date(dienst.van * 1000);
    const day = start.getDate();
    const month0 = start.getMonth(); // 0-based
    const year = start.getFullYear();
    const wg = dienst.idwaarneemgroep ?? '';
    const key = `${day}-${month0}-${year}-${dienst.van}-${dienst.tot}-${wg}`;
    const existing = byKey.get(key);
    if (existing) {
      if (dienst.type === 1 && !existing.base) {
        existing.base = dienst;
      }
      existing.items.push(dienst);
    } else {
      byKey.set(key, {
        base: dienst.type === 1 ? dienst : null,
        items: [dienst],
      });
    }
  }

  const blocks: ShiftBlockView[] = [];

  for (const { base, items } of byKey.values()) {
    if (!base) {
      // No type-1 dienst (slot) in this group: skip for now.
      continue;
    }

    const start = new Date(base.van * 1000);
    const end = new Date(base.tot * 1000);

    const day = start.getDate();
    const month0 = start.getMonth();
    const year = start.getFullYear();

    const startTime = `${formatTwoDigits(start.getHours())}:${formatTwoDigits(start.getMinutes())}`;
    const endTime = `${formatTwoDigits(end.getHours())}:${formatTwoDigits(end.getMinutes())}`;

    const currentDate = `${start.getFullYear()}-${formatTwoDigits(
      start.getMonth() + 1
    )}-${formatTwoDigits(start.getDate())} ${startTime}:00`;
    const nextDate = `${end.getFullYear()}-${formatTwoDigits(
      end.getMonth() + 1
    )}-${formatTwoDigits(end.getDate())} ${endTime}:00`;

    let middle: DoctorInfo | null = null;
    let assignedDienstId: number | undefined;
    let top: DoctorInfo | null = null;
    let bottom: DoctorInfo | null = null;

    for (const dienst of items) {
      switch (dienst.type) {
        case 0:
        case 4:
        case 6: {
          if (!middle) {
            middle = toDoctorInfo(dienst);
            if (Number.isFinite(dienst.id) && dienst.id > 0) {
              assignedDienstId = dienst.id;
            }
          }
          break;
        }
        case 5: {
          if (!top) top = toDoctorInfo(dienst);
          break;
        }
        case 9:
        case 11: {
          // 9 = Extra Dokter (legacy PHP); 11 kept only so older rows from this app still render
          if (!bottom) bottom = toDoctorInfo(dienst);
          break;
        }
        default:
          break;
      }
    }

    // Assignment rows may have partial or wider van/tot than the type=1 slot (legacy PHP
    // creates split shifts). Fall back to overlap matching when exact grouping missed them.
    const wg = base.idwaarneemgroep ?? 0;
    if (!middle) {
      for (const dienst of response.data.diensten) {
        const t = dienst.type;
        if (t !== 0 && t !== 4 && t !== 6) continue;
        if ((dienst.idwaarneemgroep ?? 0) !== wg) continue;
        if (!intervalsOverlap(dienst.van, dienst.tot, base.van, base.tot)) continue;
        const d = toDoctorInfo(dienst);
        if (d) {
          middle = d;
          if (Number.isFinite(dienst.id) && dienst.id > 0) {
            assignedDienstId = dienst.id;
          }
          break;
        }
      }
    }
    if (!top) {
      for (const dienst of response.data.diensten) {
        if (dienst.type !== 5) continue;
        if ((dienst.idwaarneemgroep ?? 0) !== wg) continue;
        if (!intervalsOverlap(dienst.van, dienst.tot, base.van, base.tot)) continue;
        const d = toDoctorInfo(dienst);
        if (d) {
          top = d;
          break;
        }
      }
    }
    if (!bottom) {
      for (const dienst of response.data.diensten) {
        const t = dienst.type;
        if (t !== 9 && t !== 11) continue;
        if ((dienst.idwaarneemgroep ?? 0) !== wg) continue;
        if (!intervalsOverlap(dienst.van, dienst.tot, base.van, base.tot)) continue;
        const d = toDoctorInfo(dienst);
        if (d) {
          bottom = d;
          break;
        }
      }
    }

    blocks.push({
      id: base.id,
      assignedDienstId,
      day,
      month: month0,
      year,
      van: base.van,
      tot: base.tot,
      startTime,
      endTime,
      currentDate,
      nextDate,
      middle,
      top,
      bottom,
      idwaarneemgroep: base.idwaarneemgroep,
    });
  }

  // Create overlay blocks for overname records (type=4/6 with status set).
  for (const dienst of overnameRecords) {
    const start = new Date(dienst.van * 1000);
    const end = new Date(dienst.tot * 1000);
    const day = start.getDate();
    const month0 = start.getMonth();
    const year = start.getFullYear();
    const startTime = `${formatTwoDigits(start.getHours())}:${formatTwoDigits(start.getMinutes())}`;
    const endTime = `${formatTwoDigits(end.getHours())}:${formatTwoDigits(end.getMinutes())}`;
    const currentDate = `${start.getFullYear()}-${formatTwoDigits(
      start.getMonth() + 1
    )}-${formatTwoDigits(start.getDate())} ${startTime}:00`;
    const nextDate = `${end.getFullYear()}-${formatTwoDigits(
      end.getMonth() + 1
    )}-${formatTwoDigits(end.getDate())} ${endTime}:00`;
    const originalDoctor = toDoctorInfo(dienst);
    const overnameType = getOvernameType(dienst);
    // Declined proposals: gray block with no initials (middle = null)
    // Pending/accepted: show the target doctor (iddeelnovern) instead of the original
    const targetDoctor = dienst.target_deelnemers ? toDoctorInfoFromDeelnemer(dienst.target_deelnemers) : null;
    const middle = overnameType === 'vraagtekenOvername' ? null : (targetDoctor ?? originalDoctor);

    blocks.push({
      id: dienst.id,
      day,
      month: month0,
      year,
      van: dienst.van,
      tot: dienst.tot,
      startTime,
      endTime,
      currentDate,
      nextDate,
      middle,
      top: null,
      bottom: null,
      idwaarneemgroep: dienst.idwaarneemgroep,
      overnameType,
      iddienstovern: dienst.iddienstovern,
      senderId: dienst.senderId,
      originalDoctor,
    });
  }

  return blocks;
}

/** Groups shift blocks by idwaarneemgroep into calendar rows (one row per waarneemgroep). */
export function groupShiftBlocksByWaarneemgroep(blocks: ShiftBlockView[]): CalendarGridRow[] {
  const byWg = new Map<number, ShiftBlockView[]>();
  for (const block of blocks) {
    const wg = block.idwaarneemgroep ?? 0;
    if (!byWg.has(wg)) byWg.set(wg, []);
    byWg.get(wg)!.push(block);
  }
  const sortedIds = Array.from(byWg.keys()).sort((a, b) => a - b);
  return sortedIds.map((id) => ({
    id,
    name: id === 0 ? 'Overig' : undefined,
    shiftBlocks: byWg.get(id)!,
  }));
}

/** Where naam comes from (e.g. WaarneemgroepContext or API waarneemgroepen list). */
export type WaarneemgroepNameSource = { id: number | null; naam?: string | null }[] | null | undefined;

/** Enriches calendar rows with waarneemgroep names from the given list (e.g. from useWaarneemgroep() context). */
export function withWaarneemgroepNames(
  rows: CalendarGridRow[],
  waarneemgroepen: WaarneemgroepNameSource
): CalendarGridRow[] {
  if (!waarneemgroepen?.length) return rows;
  return rows.map((row) => {
    const wg = waarneemgroepen.find((w) => w.id != null && w.id === row.id);
    const name = wg?.naam ?? row.name ?? (row.id === 0 ? 'Overig' : `Waarneemgroep ${row.id}`);
    return { ...row, name };
  });
}

/** React hook wrapper around dienstenToShiftBlocks. */
export function useDienstenSchedule(response: DienstenResponse | null | undefined): {
  shiftBlocks: ShiftBlockView[];
} {
  const shiftBlocks = useMemo(() => dienstenToShiftBlocks(response), [response]);
  return { shiftBlocks };
}

