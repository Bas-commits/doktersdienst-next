import { useMemo } from 'react';
import type { DienstenResponse, ShiftBlockView, Dienst, DoctorInfo } from '@/types/diensten';

function formatTwoDigits(n: number): string {
  return n.toString().padStart(2, '0');
}

function toDoctorInfo(dienst: Dienst): DoctorInfo | null {
  const d = dienst.diensten_deelnemers;
  if (!d) return null;
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

/** Pure transformer: converts diensten API response into flat ShiftBlockView list. */
export function dienstenToShiftBlocks(response: DienstenResponse | null | undefined): ShiftBlockView[] {
  if (!response?.data?.diensten?.length) return [];

  const relevantTypes = new Set<number>([0, 1, 5, 9]);
  const byKey = new Map<string, { base: Dienst | null; items: Dienst[] }>();

  for (const dienst of response.data.diensten) {
    if (!relevantTypes.has(dienst.type)) continue;
    const start = new Date(dienst.van * 1000);
    const day = start.getDate();
    const month0 = start.getMonth(); // 0-based
    const year = start.getFullYear();
    const key = `${day}-${month0}-${year}-${dienst.van}-${dienst.tot}`;
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
    let top: DoctorInfo | null = null;
    let bottom: DoctorInfo | null = null;

    for (const dienst of items) {
      switch (dienst.type) {
        case 0: {
          if (!middle) middle = toDoctorInfo(dienst);
          break;
        }
        case 5: {
          if (!top) top = toDoctorInfo(dienst);
          break;
        }
        case 9: {
          if (!bottom) bottom = toDoctorInfo(dienst);
          break;
        }
        default:
          break;
      }
    }

    blocks.push({
      id: base.id,
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
    });
  }

  return blocks;
}

/** React hook wrapper around dienstenToShiftBlocks. */
export function useDienstenSchedule(response: DienstenResponse | null | undefined): {
  shiftBlocks: ShiftBlockView[];
} {
  const shiftBlocks = useMemo(() => dienstenToShiftBlocks(response), [response]);
  return { shiftBlocks };
}

