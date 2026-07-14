'use client';

import { useRef, type PointerEvent, type ReactNode } from 'react';
import { datesBetweenInclusive, formatIsoDate, monthCalendarBounds } from '@/lib/praktijkplanner/dates';
import type { PraktijkplannerDaypart, PraktijkplannerParticipant } from '@/types/praktijkplanner';
import type { PlannerDaypartCell } from './PlannerDaypartGrid';
import {
  PlannerCursorToolFollower,
  usePlannerCursorTool,
  type PlannerCursorTool,
} from './PlannerCursorTool';

const WEEKDAYS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

export function PlannerMonthDaypartGrid({
  participant,
  dayparts,
  year,
  month,
  renderCell,
  onCellClick,
  onCellPointerEnter,
  isCellDisabled,
  holidayLabels,
  blockedDates,
  renderBlockedCell,
  cursorTool,
  onCursorToolDismiss,
}: {
  participant: PraktijkplannerParticipant;
  dayparts: PraktijkplannerDaypart[];
  year: number;
  month: number;
  renderCell: (cell: PlannerDaypartCell) => ReactNode;
  onCellClick?: (cell: PlannerDaypartCell) => void;
  onCellPointerEnter?: (cell: PlannerDaypartCell, event: PointerEvent<HTMLButtonElement>) => void;
  isCellDisabled?: (cell: PlannerDaypartCell) => boolean;
  holidayLabels?: ReadonlyMap<string, string[]>;
  blockedDates?: ReadonlySet<string>;
  renderBlockedCell?: (cell: PlannerDaypartCell) => ReactNode;
  cursorTool?: PlannerCursorTool | null;
  onCursorToolDismiss?: () => void;
}) {
  const bounds = monthCalendarBounds(year, month);
  const gridRootRef = useRef<HTMLDivElement>(null);
  const cursorPosition = usePlannerCursorTool({
    active: cursorTool != null,
    containerRef: gridRootRef,
    onDismiss: onCursorToolDismiss,
  });
  if (!bounds) return null;

  const dates = datesBetweenInclusive(bounds.start, bounds.end);
  const orderedDayparts = [...dayparts].sort((a, b) => a.volgorde - b.volgorde);
  const today = formatIsoDate(new Date());

  return (
    <div ref={gridRootRef}>
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="p-2 text-center text-xs font-semibold text-muted-foreground">
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dates.map((datum) => {
            const date = new Date(`${datum}T12:00:00`);
            const inMonth = date.getMonth() + 1 === month;
            const holidays = holidayLabels?.get(datum) ?? [];
            const blocked = blockedDates?.has(datum) ?? false;
            return (
              <div
                key={datum}
                className={[
                  'min-h-36 border-r border-b p-1 last:border-r-0',
                  inMonth ? 'bg-card' : 'bg-muted/30 text-muted-foreground',
                  datum === today ? 'ring-2 ring-inset ring-emerald-600' : '',
                ].join(' ')}
              >
                <div className="mb-1 flex items-start justify-between gap-1 px-1">
                  <p className="text-xs font-semibold">{date.getDate()}</p>
                  {holidays.length > 0 ? (
                    <span className="max-w-20 truncate text-[9px] font-medium text-rose-700" title={holidays.join(', ')}>
                      {holidays[0]}
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {orderedDayparts.map((daypart) => {
                    const cell = { participant, datum, daypart };
                    const disabled = blocked || isCellDisabled?.(cell) || !onCellClick;
                    return (
                      <button
                        key={`${datum}-${daypart.id}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => onCellClick?.(cell)}
                        onPointerEnter={(event) => onCellPointerEnter?.(cell, event)}
                        className="group/cell relative flex min-h-12 w-full items-center justify-center rounded border border-border/70 px-1 text-left text-[10px] enabled:cursor-pointer enabled:hover:border-primary/60 enabled:hover:bg-muted disabled:cursor-default disabled:opacity-80"
                        aria-label={`${datum} ${daypart.naam}${blocked ? ' feestdag' : ''}`}
                      >
                        <span className="absolute top-0.5 left-1 text-[8px] text-muted-foreground">
                          {daypart.naam.slice(0, 1)}
                        </span>
                        <span className="min-w-0 max-w-full">{blocked ? renderBlockedCell?.(cell) ?? renderCell(cell) : renderCell(cell)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    <PlannerCursorToolFollower tool={cursorTool ?? null} position={cursorPosition} />
    </div>
  );
}
