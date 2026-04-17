import React, { useMemo } from 'react';
import type { VakantieItem, WeekDateRangeItem } from '@/types/rooster';
import type { ShiftBlockSection } from '@/types/rooster-maken';
import type { ShiftBlockView } from '@/types/diensten';
import type { ChipDefinition, VoorkeurItem } from '@/types/voorkeuren';
import { CHIP_DEFINITIONS, shiftKeyFromBlock, getChipByCode as getChipByCodeFromTypes } from '@/types/voorkeuren';
import { getWeek, monthWeekCount, getDateRangeOfWeek, getWeekNumber } from '@/utils/calendarUtils';
import { ShiftBlock } from '@/components/ShiftBlock/ShiftBlock';
import { MonthNavigation } from './MonthNavigation';

/** One row of shift blocks (e.g. per waarneemgroep). */
export interface CalendarGridRow {
  id: number;
  /** Optional label shown in the row header (e.g. waarneemgroep name). */
  name?: string;
  shiftBlocks: ShiftBlockView[];
}

export interface CalendarGridProps {
  /** Single set of shift blocks (one row per week). Use when no waarneemgroep grouping. */
  shiftBlocks?: ShiftBlockView[];
  /** Rows of shift blocks (e.g. one per waarneemgroep). Each row gets its own strip per week. When set, shiftBlocks is ignored. */
  rows?: CalendarGridRow[];
  viewMonth: number;
  viewYear: number;
  /** Optional: when set, shift blocks are clickable and this is called with block, position, and optionally section (top/middle/bottom) */
  onShiftClick?: (block: ShiftBlockView, position: { top: number; left: number }, section?: ShiftBlockSection) => void;
  /**
   * Optional: when set, each stripe (top/middle/bottom) is individually clickable for planning.
   * All empty strip borders are shown to indicate clickability.
   * Use this instead of onShiftClick in the secretaris planning view.
   */
  onSectionShiftClick?: (block: ShiftBlockView, section: 'top' | 'middle' | 'bottom') => void;
  /**
   * Optional: preference map for the currently selected planner doctor.
   * Key: "${van}_${tot}", value: ChipDefinition to show on that shift block.
   * When set, overrides the block's own assignedPreferenceCode rendering.
   */
  plannerDoctorPreferenceMap?: Map<string, ChipDefinition>;
  /** Optional: when true, the top (Achterwacht) strip is not rendered on any shift block. */
  hideTopStrip?: boolean;
  /** Optional: when true, the bottom (Extra Dokter) strip is not rendered on any shift block. */
  hideBottomStrip?: boolean;
  /** Optional: when set, each shift block shows a delete button that calls this with the block. */
  onShiftDelete?: (block: ShiftBlockView) => void;
  /** Optional: vacation labels per day. */
  vakanties?: VakantieItem[];
  /** Optional: when set, month navigation is shown above the calendar and this is called when the user selects a month/year. */
  onViewMonthChange?: (month: number, year: number) => void;
  /** Optional: shiftKey -> chip code for pending preference inserts (voorkeuren). */
  pendingInsert?: Map<string, string>;
  /** Optional: shiftKeys marked for preference removal (voorkeuren Weghalen). */
  pendingDelete?: Set<string>;
  /** Optional: resolve chip code to definition for rendering on blocks. Defaults to getChipByCode from types. */
  getChipByCode?: (code: string) => ChipDefinition | undefined;
  /** When false, preference UI on shift blocks is hidden. Default true. */
  showPreferences?: boolean;
  /** When set, renders voorkeur blocks per user below the shift lane (secretaris view). */
  voorkeuren?: VoorkeurItem[];
}

/** Width of the right-hand column that shows waarneemgroep names per row (when multiple rows). */
const ROW_LABEL_WIDTH = 140;

/** Pad number to two digits for HH:MM. */
function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Returns blocks that overlap the given calendar day, with the segment of each shift
 * that falls within that day (start/end as "HH:MM" in that day).
 * Used for overnight and multi-day shifts so they render in every day they span.
 */
function getBlocksWithSegmentsForDay(
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
function blockOverlapsDay(
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
function getPrevDate(day: number, month0: number, year: number): { day: number; month0: number; year: number } {
  const d = new Date(year, month0, day);
  d.setDate(d.getDate() - 1);
  return { day: d.getDate(), month0: d.getMonth(), year: d.getFullYear() };
}

/** Next calendar date (day + 1, handling month/year boundaries). */
function getNextDate(day: number, month0: number, year: number): { day: number; month0: number; year: number } {
  const d = new Date(year, month0, day);
  d.setDate(d.getDate() + 1);
  return { day: d.getDate(), month0: d.getMonth(), year: d.getFullYear() };
}

// ─── Voorkeur lane computation ────────────────────────────────────────────────

type VoorkeurLaneEntry = {
  voorkeur: VoorkeurItem;
  segmentStartTime: string;
  segmentEndTime: string;
  continuesFromPrev: boolean;
  continuesToNext: boolean;
};

/** Per-user slot in the week layout: fixed row position and fixed lane count across all days. */
type WeekUserSlot = { userId: number; initials: string; numLanes: number };

/**
 * Pre-computed voorkeur layout for one week row.
 * Contains the ordered list of user slots (same for every day) and per-day lane data.
 * Every day in the week renders the same user slots in the same order,
 * guaranteeing consistent row heights across the week.
 */
type WeekVoorkeurLayout = {
  /** Ordered user slots — the same list is used for every day in the week. */
  users: WeekUserSlot[];
  /**
   * Per day (key = "day-month1-year"), per user slot index: the lane entries to render.
   * If a user has no preference on a given day, their lanes array is empty ([]).
   */
  byDay: Map<string, VoorkeurLaneEntry[][][]>;
};

/**
 * Computes the voorkeur layout for an entire week row.
 *
 * Lane assignment is done GLOBALLY per user across all voorkeuren for the whole
 * week (not per day). This guarantees that an overnight voorkeur always occupies
 * the same lane on both the starting day and the ending day, so it appears as a
 * visually continuous bar across the midnight boundary.
 *
 * segmentEndTime boundary fix: uses `endMs >= dayEndMs` to emit '24:00' instead
 * of checking getHours() === 23, which fails when dayEndMs is midnight (00:00).
 */
function computeWeekVoorkeurLayout(
  voorkeuren: VoorkeurItem[],
  weekDates: WeekDateRangeItem[],
): WeekVoorkeurLayout {
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Determine the time range covered by this week row.
  const firstRange = weekDates[0];
  const lastRange = weekDates[weekDates.length - 1];
  const weekStartMs = new Date(firstRange.Year, firstRange.Month, firstRange.Day, 0, 0, 0, 0).getTime();
  const weekEndMs = new Date(lastRange.Year, lastRange.Month, lastRange.Day, 0, 0, 0, 0).getTime() + DAY_MS;

  // Filter voorkeuren that overlap this week at all.
  const weekVks = voorkeuren.filter(
    (vk) => vk.van * 1000 < weekEndMs && vk.tot * 1000 > weekStartMs,
  );

  // Group by user across the full week.
  const byUser = new Map<number, VoorkeurItem[]>();
  for (const vk of weekVks) {
    if (vk.iddeelnemer == null) continue;
    if (!byUser.has(vk.iddeelnemer)) byUser.set(vk.iddeelnemer, []);
    byUser.get(vk.iddeelnemer)!.push(vk);
  }

  // Global lane assignment per user: each voorkeur gets a fixed lane index that
  // is consistent across ALL days it spans (no per-day re-assignment).
  const userInitials = new Map<number, string>();
  const userMaxLanes = new Map<number, number>();
  const vkToLane = new Map<VoorkeurItem, number>();

  for (const [userId, vks] of byUser) {
    const d = vks[0].deelnemer;
    userInitials.set(
      userId,
      ((d?.voornaam?.[0] ?? '') + (d?.achternaam?.[0] ?? '')).toUpperCase(),
    );

    const sorted = [...vks].sort((a, b) => a.van - b.van);
    // laneContents tracks which vks are assigned to each lane, for conflict checking.
    const laneContents = new Map<number, VoorkeurItem[]>();

    for (const vk of sorted) {
      for (let laneIdx = 0; ; laneIdx++) {
        const existing = laneContents.get(laneIdx) ?? [];
        // Different-type temporal overlap → conflict, try next lane.
        const hasConflict = existing.some(
          (ex) =>
            ex.type !== vk.type &&
            ex.van * 1000 < vk.tot * 1000 &&
            ex.tot * 1000 > vk.van * 1000,
        );
        if (!hasConflict) {
          if (!laneContents.has(laneIdx)) laneContents.set(laneIdx, []);
          laneContents.get(laneIdx)!.push(vk);
          vkToLane.set(vk, laneIdx);
          break;
        }
      }
    }

    userMaxLanes.set(userId, laneContents.size);
  }

  // Build per-day lane data using the globally assigned lane indices.
  const p2 = (n: number) => n.toString().padStart(2, '0');
  const byDayRaw = new Map<string, Map<number, VoorkeurLaneEntry[][]>>();

  for (const range of weekDates) {
    const day = range.Day;
    const month0 = range.Month;
    const year = range.Year;
    const dateKey = `${day}-${range.Month + 1}-${year}`;
    const dayStartMs = new Date(year, month0, day, 0, 0, 0, 0).getTime();
    const dayEndMs = dayStartMs + DAY_MS; // = midnight of the next day

    const dayMap = new Map<number, VoorkeurLaneEntry[][]>();

    for (const [userId, vks] of byUser) {
      const numLanes = userMaxLanes.get(userId) ?? 1;
      const lanes: VoorkeurLaneEntry[][] = Array.from({ length: numLanes }, () => []);

      for (const vk of vks) {
        if (vk.van * 1000 >= dayEndMs || vk.tot * 1000 <= dayStartMs) continue;

        const laneIdx = vkToLane.get(vk) ?? 0;
        const startMs = Math.max(vk.van * 1000, dayStartMs);
        const endMs = Math.min(vk.tot * 1000, dayEndMs);
        const segStart = new Date(startMs);
        const segEnd = new Date(endMs);

        lanes[laneIdx].push({
          voorkeur: vk,
          segmentStartTime: `${p2(segStart.getHours())}:${p2(segStart.getMinutes())}`,
          // endMs === dayEndMs means the segment reaches midnight: emit '24:00'.
          // (segEnd.getHours() would be 0 here, not 23, so the old hours-check was wrong.)
          segmentEndTime: endMs >= dayEndMs
            ? '24:00'
            : `${p2(segEnd.getHours())}:${p2(segEnd.getMinutes())}`,
          continuesFromPrev: vk.van * 1000 < dayStartMs,
          continuesToNext: vk.tot * 1000 > dayEndMs,
        });
      }

      dayMap.set(userId, lanes);
    }

    byDayRaw.set(dateKey, dayMap);
  }

  // Build stable user slot order (sorted by userId for consistency across re-renders).
  const users: WeekUserSlot[] = Array.from(userInitials.keys())
    .sort((a, b) => a - b)
    .map((userId) => ({
      userId,
      initials: userInitials.get(userId)!,
      numLanes: userMaxLanes.get(userId) ?? 1,
    }));

  // Convert to indexed arrays matching the users order.
  const byDayIndexed = new Map<string, VoorkeurLaneEntry[][][]>();
  for (const [dateKey, dayMap] of byDayRaw) {
    byDayIndexed.set(
      dateKey,
      users.map((u) => dayMap.get(u.userId) ?? []),
    );
  }

  return { users, byDay: byDayIndexed };
}

function voorkeurToShiftBlockView(vk: VoorkeurItem): ShiftBlockView {
  const d = vk.deelnemer;
  const vanDate = new Date(vk.van * 1000);
  const totDate = new Date(vk.tot * 1000);
  const p2 = (n: number) => n.toString().padStart(2, '0');
  const fmtDate = (dt: Date) =>
    `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())} ${p2(dt.getHours())}:${p2(dt.getMinutes())}:00`;
  const initials = ((d?.voornaam?.[0] ?? '') + (d?.achternaam?.[0] ?? '')).toUpperCase();
  const fullName = [d?.voornaam, d?.achternaam].filter(Boolean).join(' ');
  return {
    id: vk.id ?? 0,
    day: vanDate.getDate(),
    month: vanDate.getMonth(),
    year: vanDate.getFullYear(),
    van: vk.van,
    tot: vk.tot,
    currentDate: fmtDate(vanDate),
    nextDate: fmtDate(totDate),
    startTime: `${p2(vanDate.getHours())}:${p2(vanDate.getMinutes())}`,
    endTime: `${p2(totDate.getHours())}:${p2(totDate.getMinutes())}`,
    label: '',
    middle: d
      ? { id: d.id ?? 0, name: fullName, shortName: initials, color: d.color ?? '#888888' }
      : null,
    top: null,
    bottom: null,
    assignedPreferenceCode: String(vk.type ?? ''),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function CalendarGrid({
  shiftBlocks,
  rows,
  viewMonth,
  viewYear,
  onShiftClick,
  onSectionShiftClick,
  plannerDoctorPreferenceMap,
  hideTopStrip,
  hideBottomStrip,
  onShiftDelete,
  vakanties,
  onViewMonthChange,
  pendingInsert,
  pendingDelete,
  getChipByCode = getChipByCodeFromTypes,
  showPreferences = true,
  voorkeuren,
}: CalendarGridProps) {
  const vakantieList: VakantieItem[] = vakanties ?? [];

  /** Normalize to rows: use rows when provided, else single row from shiftBlocks. */
  const gridRows: CalendarGridRow[] = useMemo(() => {
    if (rows?.length) return rows;
    const blocks = shiftBlocks ?? [];
    return [{ id: 0, shiftBlocks: blocks }];
  }, [rows, shiftBlocks]);

  const month0 = viewMonth; // viewMonth is 0-based (matches Rooster/Date); API is called with month+1 elsewhere
  let totalWeek = monthWeekCount(viewYear, month0);
  let currentMonthStartWeek = getWeek(new Date(viewYear, month0, 1));
  let displayYear = viewYear;
  if (currentMonthStartWeek === 52) {
    displayYear -= 1;
    totalWeek += 1;
  }

  const weekRows: { weekNo: number; year: number; dates: WeekDateRangeItem[] }[] = [];
  for (let i = 0; i < totalWeek; i++) {
    const dates = getDateRangeOfWeek(currentMonthStartWeek, displayYear);
    weekRows.push({ weekNo: currentMonthStartWeek, year: displayYear, dates });
    currentMonthStartWeek += 1;
  }

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  const vakantieByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const v of vakantieList) {
      const parts1 = v.current_date.split(/[-/]/);
      const parts2 = v.next_date.split(/[-/]/);
      const d1 = parts1.length >= 3
        ? new Date(Number(parts1[0]), Number(parts1[1]) - 1, Number(parts1[2]))
        : new Date(v.current_date);
      const d2 = parts2.length >= 3
        ? new Date(Number(parts2[0]), Number(parts2[1]) - 1, Number(parts2[2]))
        : new Date(v.next_date);
      const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      for (let i = 0; i <= diff; i++) {
        const d = new Date(d1);
        d.setDate(d.getDate() + i);
        const key = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(v.naam);
      }
    }
    return map;
  }, [vakantieList]);

  const weekdays = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

  const content = (
    <>
      <div className="w-full flex">
        <div className="w-[60px]" />
        {weekdays.map((dayLabel) => (
          <div
            key={dayLabel}
            className="min-w-[100px] flex-1 h-[20px] mb-2 pl-2 text-base font-bold text-[#292727]"
          >
            {dayLabel}
          </div>
        ))}
        {gridRows.length > 1 && <div className="shrink-0" style={{ width: ROW_LABEL_WIDTH }} />}
      </div>

      <div className="w-full mx-auto" data-tooltip="Chip Active">
        {weekRows.map(({ weekNo, year: weekYear, dates }) => {
          const weekInfo = getWeekNumber(dates[0].Date);
          // Compute voorkeur layout once per week row so all 7 days share the same
          // user order and lane counts → consistent row heights across the week.
          const weekVoorkeurLayout =
            voorkeuren && voorkeuren.length > 0
              ? computeWeekVoorkeurLayout(voorkeuren, dates)
              : null;
          return (
            <div key={`${weekNo}-${weekYear}`} className="flex w-full items-stretch justify-center">
              {/* Left week-number column (e.g. "Week 12"). */}
              <div className="w-[60px] shrink-0 self-center">
                <div className="h-[30px] -rotate-90 text-base font-bold text-[#c1c1c1] whitespace-nowrap">
                  Week {weekInfo.week}
                </div>
              </div>
              {/* One visual "week row" container that holds all 7 day cells. */}
              <div className="flex flex-1 min-w-0 relative border border-[#979797] rounded-[13px] mb-2.5">
                {dates.map((range) => {
                  const rangeDay = range.Day;
                  const rangeMonth1 = range.Month + 1;
                  const rangeYear = range.Year;
                  const dateKey = `${rangeDay}-${rangeMonth1}-${rangeYear}`;

                  const isToday =
                    rangeDay === todayDay &&
                    rangeMonth1 === todayMonth &&
                    rangeYear === todayYear;

                  const vacationLabels = vakantieByDate.get(dateKey) ?? [];

                  return (
                    <div
                      key={dateKey}
                      className="min-w-[100px] flex-1 min-h-[110px] p-0 border-r border-[#c4c4c4] first:rounded-l-[13px] last:rounded-r-[13px] last:border-r-0 last:border-0 overflow-visible flex flex-col"
                    >
                      {/* Day header in this cell: date number + optional vacation labels. */}
                      <div
                        className="text-[#a0a0a0] text-[25px] my-0 mx-[5px] ml-2.5 flex items-center justify-between leading-none [&>span]:text-sm [&>span]:font-semibold [&>span]:tracking-[0.5px] [&>span]:text-[#c5c5c5]"
                        data-day-month-year={dateKey}
                        style={
                          isToday
                            ? {
                                color: 'white',
                                backgroundColor: 'green',
                                fontWeight: 'bold',
                                width: '30px',
                                borderRadius: '6px',
                              }
                            : undefined
                        }
                      >
                        {rangeDay}
                        {vacationLabels.length > 0 && (
                          <span className="text-[10px] text-green-600">
                            {vacationLabels.join(', ')}
                          </span>
                        )}
                      </div>
                      {/* Shift-lane wrapper for this day cell (currently one lane per grid row). */}
                      <div className="flex flex-1 flex-col gap-1.5 min-h-0">
                        {/* Primary shift row in this day cell. */}
                        {gridRows.map((row) => {
                          const blocksWithSegments = getBlocksWithSegmentsForDay(
                            row.shiftBlocks,
                            rangeDay,
                            range.Month,
                            rangeYear
                          );
                          return (
                            <div
                              key={row.id}
                              className="flex items-center relative min-h-[80px] m-0"
                              data-block={row.id}
                              data-row-name={row.name}
                            >
                              {blocksWithSegments.map(({ block, segmentStartTime, segmentEndTime }, blockIndex) => {
                                const prev = getPrevDate(rangeDay, range.Month, rangeYear);
                                const next = getNextDate(rangeDay, range.Month, rangeYear);
                                const continuesFromPrev = blockOverlapsDay(block, prev.day, prev.month0, prev.year);
                                const continuesToNext = blockOverlapsDay(block, next.day, next.month0, next.year);
                                const blockKey = shiftKeyFromBlock(block);
                                const isPendingDelete = pendingDelete?.has(blockKey);
                                const pendingCode = pendingInsert?.get(blockKey);
                                // Planner preference preview overrides block's own preference
                                const plannerChip = plannerDoctorPreferenceMap?.get(`${block.van}_${block.tot}`);
                                const preferenceChip: ChipDefinition | undefined =
                                  plannerChip ??
                                  (isPendingDelete
                                    ? undefined
                                    : pendingCode
                                      ? getChipByCode(pendingCode)
                                      : block.assignedPreferenceCode
                                        ? getChipByCode(block.assignedPreferenceCode)
                                        : undefined);
                                return (
                                  <ShiftBlock
                                    key={`${block.id}-${block.van}-${block.tot}-${dateKey}-${blockIndex}`}
                                    block={block}
                                    day={rangeDay}
                                    month={range.Month}
                                    year={rangeYear}
                                    segmentStartTime={segmentStartTime}
                                    segmentEndTime={segmentEndTime}
                                    continuesFromPrev={continuesFromPrev}
                                    continuesToNext={continuesToNext}
                                    hideTopStrip={hideTopStrip}
                                    hideBottomStrip={hideBottomStrip}
                                    showEmptyTopStripBorder={onSectionShiftClick != null}
                                    showEmptyBottomStripBorder={onSectionShiftClick != null}
                                    onDelete={
                                      onShiftDelete
                                        ? () => onShiftDelete(block)
                                        : undefined
                                    }
                                    onClick={
                                      onShiftClick
                                        ? (e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            onShiftClick(block, {
                                              top: rect.top + window.scrollY,
                                              left: rect.left + window.scrollX,
                                            });
                                          }
                                        : undefined
                                    }
                                    onSectionClick={
                                      onSectionShiftClick
                                        ? (section) => onSectionShiftClick(block, section)
                                        : undefined
                                    }
                                    preferenceChip={preferenceChip ?? null}
                                    overnameType={block.overnameType}
                                  />
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                      {/* Voorkeur blocks: rendered using the week-level layout so every
                          day in the week shows the same user rows in the same order
                          with the same lane heights — ensuring visual alignment. */}
                      {(showPreferences || weekVoorkeurLayout) && (
                        <div className="mt-2 border-t border-[#979797]" aria-label="preferences row">
                          {weekVoorkeurLayout && weekVoorkeurLayout.users.length > 0 ? (
                            // Per-user band: same structure for every day in the week.
                            weekVoorkeurLayout.users.map((slot, slotIdx) => {
                              const dayLanes = weekVoorkeurLayout.byDay.get(dateKey)?.[slotIdx] ?? [];
                              return (
                                <div key={slot.userId} className="mb-px">
                                  {/* Render slot.numLanes lanes; empty lanes keep the height stable. */}
                                  {Array.from({ length: slot.numLanes }).map((_, laneIdx) => {
                                    const lane = dayLanes[laneIdx] ?? [];
                                    return (
                                      <div key={laneIdx} className="relative" style={{ height: 22 }}>
                                        {lane.map(({ voorkeur, segmentStartTime, segmentEndTime, continuesFromPrev, continuesToNext }) => (
                                          <ShiftBlock
                                            key={`vk-${voorkeur.id ?? `${voorkeur.iddeelnemer}_${voorkeur.idwaarneemgroep ?? 0}_${voorkeur.type}`}-${voorkeur.van}-${voorkeur.tot}`}
                                            block={voorkeurToShiftBlockView(voorkeur)}
                                            day={rangeDay}
                                            month={range.Month}
                                            year={rangeYear}
                                            hideTopStrip
                                            hideBottomStrip
                                            middleHeight={20}
                                            disableActiveHighlight
                                            segmentStartTime={segmentStartTime}
                                            segmentEndTime={segmentEndTime}
                                            continuesFromPrev={continuesFromPrev}
                                            continuesToNext={continuesToNext}
                                            preferenceChip={
                                              CHIP_DEFINITIONS.find((c) => c.code === String(voorkeur.type ?? '')) ?? null
                                            }
                                          />
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })
                          ) : (
                            // No voorkeuren this week: render empty placeholder for showPreferences pages.
                            <div className="min-h-[80px]" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Right column with row labels; mirrors the vertical shift lanes. */}
              {gridRows.length > 1 && (
                <div
                  className="shrink-0 self-stretch pl-2 mb-2.5 flex flex-col"
                  style={{ width: ROW_LABEL_WIDTH }}
                >
                  <div className="min-h-[36px]" aria-hidden />
                  <div className="flex flex-1 flex-col gap-1.5">
                    {gridRows.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center min-h-[80px] m-0 text-sm text-[#292727]"
                      >
                        {row.name ?? `Waarneemgroep ${row.id}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            
          );
          
        })}
      </div>
    </>
  );

  return (
    <div>
      {onViewMonthChange && (
        <div
          className={`mb-4 ml-[60px]${gridRows.length > 2 ? ' mr-[140px]' : ''}`}
        >
          <MonthNavigation
            month={viewMonth}
            year={viewYear}
            onSelectMonth={onViewMonthChange}
          />
        </div>
      )}
      {content}
    </div>
  );
}

