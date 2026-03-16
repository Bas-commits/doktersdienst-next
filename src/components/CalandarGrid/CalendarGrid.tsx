import React, { useMemo } from 'react';
import type { VakantieItem, WeekDateRangeItem } from '@/types/rooster';
import type { ShiftBlockSection } from '@/types/rooster-maken';
import type { ShiftBlockView } from '@/types/diensten';
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
}

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

export function CalendarGrid({
  shiftBlocks,
  rows,
  viewMonth,
  viewYear,
  onShiftClick,
  hideTopStrip,
  hideBottomStrip,
  onShiftDelete,
  vakanties,
  onViewMonthChange,
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
      </div>

      <div className="w-full mx-auto" data-tooltip="Chip Active">
        {weekRows.map(({ weekNo, year: weekYear, dates }) => {
          const weekInfo = getWeekNumber(dates[0].Date);
          return (
            <div key={`${weekNo}-${weekYear}`} className="flex w-full items-center justify-center">
              <div className="w-[60px] shrink-0">
                <div className="h-[30px] -rotate-90 text-base font-bold text-[#c1c1c1] whitespace-nowrap">
                  Week {weekInfo.week}
                </div>
              </div>
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
                      <div className="flex flex-1 flex-col gap-1.5 min-h-0">
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
                                  />
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div>
      {onViewMonthChange && (
        <div className="mb-4 ml-[60px]">
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

