/**
 * Types for the get-indicate-preference API and voorkeuren calendar UI.
 * Aligned with backend PreferenceController and voorkeuren.js.
 */

import type { RoosterChip, VakantieItem } from './rooster';
import type { ShiftBlockView } from './diensten';

// Re-export for convenience: ChipData items share the same shape as rooster chips
export type { RoosterChip, VakantieItem };

export interface VoorkeurenDoctorItem {
  DoctorID: number;
  Name: string;
  senddate?: string;
}

/** Response from GET /api/get-indicate-preference */
export interface VoorkeurenResponse {
  success: boolean;
  ChipData: RoosterChip[];
  DoctorData: VoorkeurenDoctorItem[];
  Vakanties: VakantieItem[];
}

/**
 * A single preference entry sent in insert/delete arrays to POST /api/indicate-preference.
 * month is 1-based; date is "DD-MM-YYYY".
 */
export interface PreferenceItem {
  doctorid: number;
  current_date: string;
  next_date: string;
  van: number | string;
  tot: number | string;
  date: string;
  day: number;
  month: number;
  year: number;
  description: string;
  code: string;
  GroupId: string;
}

export interface PendingChanges {
  insert: PreferenceItem[];
  delete: PreferenceItem[];
}

/** Definition of a selectable preference chip type. */
export interface ChipDefinition {
  /** API code, e.g. "1006". "1014" is the delete/remove chip. */
  code: string;
  label: string;
  /** Path to icon shown on the chip selector button */
  selectorIconPath: string;
  /** Path to icon shown inside the calendar shift block when applied */
  chipIconPath: string;
}

export const CHIP_DEFINITIONS: ChipDefinition[] = [
  {
    code: '1014',
    label: 'Weghalen',
    selectorIconPath: '',
    chipIconPath: '',
  },
  {
    code: '3',
    label: 'Liever wel',
    selectorIconPath: '/images/icons/check.svg',
    chipIconPath: '/images/icons/check.svg',
  },
  {
    code: '2',
    label: 'Liever niet',
    selectorIconPath: '/images/icons/cross.svg',
    chipIconPath: '/images/icons/cross.svg',
  },
  {
    code: '9',
    label: 'Vakantie',
    selectorIconPath: '/images/icons/holliday.svg',
    chipIconPath: '/images/icons/holliday-bg.svg',
  },
  {
    code: '10',
    label: 'Nascholing',
    selectorIconPath: '/images/icons/education.svg',
    chipIconPath: '/images/icons/education-bg.svg',
  },
  {
    code: '5001',
    label: 'FTE',
    selectorIconPath: '/images/icons/FTE.svg',
    chipIconPath: '/images/icons/FTE-bg.svg',
  },
];

/** Unique key for a shift slot, used to track pending changes. */
export function shiftKey(
  currentDate: string,
  van: number | string,
  tot: number | string,
  doctorId: number
): string {
  return `${currentDate}_${van}_${tot}_${doctorId}`;
}

/** Unique key for a shift block (ShiftBlockView), used for pending preference state. */
export function shiftKeyFromBlock(block: ShiftBlockView): string {
  return `${block.currentDate}_${block.van}_${block.tot}_${block.id}`;
}

/** Look up chip definition by code for rendering on blocks. */
export function getChipByCode(code: string): ChipDefinition | undefined {
  return CHIP_DEFINITIONS.find((c) => c.code === code);
}

/** Format a day/month/year to "DD-MM-YYYY" as expected by the POST API. */
export function formatDateDDMMYYYY(
  day: number | string,
  month: number | string,
  year: number | string
): string {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  return (
    (d < 10 ? `0${d}` : String(d)) +
    '-' +
    (m < 10 ? `0${m}` : String(m)) +
    '-' +
    String(y)
  );
}

/**
 * Build insert/delete arrays for POST /api/indicate-preference.
 * Uses currentUserDoctorId for doctorid (not chip.IDdeelnemer) so preferences
 * are saved for the logged-in user; backend returns preferences for Auth::id().
 */
export function buildPreferencePayload(
  chips: RoosterChip[],
  pendingInsert: Map<string, string>,
  pendingDelete: Set<string>,
  groupId: string,
  currentUserDoctorId: number
): PendingChanges {
  const insertItems: PreferenceItem[] = [];
  pendingInsert.forEach((code, key) => {
    const chip = chips.find(
      (c) => shiftKey(c.current_date, c.van, c.tot, c.IDdeelnemer) === key
    );
    if (!chip) return;
    insertItems.push({
      doctorid: currentUserDoctorId,
      current_date: chip.current_date,
      next_date: chip.next_date,
      van: chip.van,
      tot: chip.tot,
      date: formatDateDDMMYYYY(chip.day, chip.month, chip.year),
      day: Number(chip.day),
      month: Number(chip.month),
      year: Number(chip.year),
      description: '',
      code,
      GroupId: groupId,
    });
  });

  const deleteItems: PreferenceItem[] = [];
  pendingDelete.forEach((key) => {
    const chip = chips.find(
      (c) => shiftKey(c.current_date, c.van, c.tot, c.IDdeelnemer) === key
    );
    if (!chip) return;
    deleteItems.push({
      doctorid: currentUserDoctorId,
      current_date: chip.current_date,
      next_date: chip.next_date,
      van: chip.van,
      tot: chip.tot,
      date: formatDateDDMMYYYY(chip.day, chip.month, chip.year),
      day: Number(chip.day),
      month: Number(chip.month),
      year: Number(chip.year),
      description: '',
      code: '1014',
      GroupId: groupId,
    });
  });

  return { insert: insertItems, delete: deleteItems };
}
