'use client';

import Image from 'next/image';
import { useRef, type ReactNode } from 'react';
import { weekDates } from '@/lib/praktijkplanner/dates';
import type { PraktijkplannerDaypart, PraktijkplannerParticipant } from '@/types/praktijkplanner';
import {
  PlannerCursorToolFollower,
  usePlannerCursorTool,
  type PlannerCursorTool,
} from './PlannerCursorTool';
import { PlannerWeekNavigation } from './PlannerWeekNavigation';
import { PLANNER_GRID_NAV_MARGIN_PX } from './planner-grid-layout';

const DAYPART_ICONS: Record<number, string> = {
  1: '/icons/sunrise.svg',
  2: '/icons/sunset.svg',
  3: '/icons/moon-down.svg',
  4: '/icons/moon-up.svg',
};

export type PlannerDaypartCell = {
  participant: PraktijkplannerParticipant;
  datum: string;
  daypart: PraktijkplannerDaypart;
};

function participantLabel(participant: PraktijkplannerParticipant): string {
  return (
    [participant.voornaam, participant.achternaam].filter(Boolean).join(' ') ||
    participant.name ||
    participant.initialen ||
    `Deelnemer ${participant.id}`
  );
}

function dayLabel(date: string): { weekday: string; day: number } {
  const value = new Date(`${date}T12:00:00`);
  return {
    weekday: new Intl.DateTimeFormat('nl-NL', { weekday: 'short' }).format(value),
    day: value.getDate(),
  };
}

function DaypartIcon({ volgorde, className }: { volgorde: number; className?: string }) {
  const icon = DAYPART_ICONS[volgorde];
  if (!icon) return null;
  return <Image src={icon} alt="" width={28} height={28} className={className ?? 'size-7 opacity-[0.25]'} />;
}

export function PlannerDaypartGrid({
  participants,
  dayparts,
  weekStart,
  onWeekStartChange,
  zoom,
  renderCell,
  onCellClick,
  isCellDisabled,
  isCellFilled,
  holidayLabels,
  cursorTool,
  onCursorToolDismiss,
}: {
  participants: PraktijkplannerParticipant[];
  dayparts: PraktijkplannerDaypart[];
  weekStart: string;
  onWeekStartChange?: (weekStart: string) => void;
  zoom?: string | number;
  renderCell: (cell: PlannerDaypartCell) => ReactNode;
  onCellClick?: (cell: PlannerDaypartCell) => void;
  isCellDisabled?: (cell: PlannerDaypartCell) => boolean;
  isCellFilled?: (cell: PlannerDaypartCell) => boolean;
  holidayLabels?: ReadonlyMap<string, string[]>;
  cursorTool?: PlannerCursorTool | null;
  onCursorToolDismiss?: () => void;
}) {
  const days = weekDates(weekStart);
  const orderedDayparts = [...dayparts].sort((a, b) => a.volgorde - b.volgorde);
  const gridRootRef = useRef<HTMLDivElement>(null);
  const cursorPosition = usePlannerCursorTool({
    active: cursorTool != null,
    containerRef: gridRootRef,
    onDismiss: onCursorToolDismiss,
  });

  return (
    <div ref={gridRootRef}>
      {onWeekStartChange ? (
        <div className="ml-44" style={{ marginBottom: `${PLANNER_GRID_NAV_MARGIN_PX}px` }}>
          <PlannerWeekNavigation weekStart={weekStart} onWeekStartChange={onWeekStartChange} />
        </div>
      ) : null}
      <div
        className="overflow-x-auto rounded-xl border bg-card shadow-sm"
        style={zoom ? { zoom: `${zoom}%` } : undefined}
      >
      <div className="min-w-[1120px]">
        <div className="grid grid-cols-[minmax(11rem,1fr)_repeat(7,minmax(9.5rem,1fr))] border-b bg-muted/40">
          <div className="flex items-center justify-center p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground h-full">Deelnemer</div>
     
          {days.map((date) => {
            const label = dayLabel(date);
            const holidays = holidayLabels?.get(date) ?? [];
            return (
              <div key={date} className="border-l p-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label.weekday}</p>
                <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{label.day}</p>
                {holidays.length > 0 ? (
                  <p className="mt-1 truncate text-[10px] font-medium text-rose-700" title={holidays.join(', ')}>
                    {holidays.join(', ')}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {participants.map((participant) => (
          <div
            key={participant.id}
            className="grid grid-cols-[minmax(11rem,1fr)_repeat(7,minmax(9.5rem,1fr))] border-b last:border-b-0"
          >
            <div className="flex min-h-30 items-center justify-left gap-2 p-3 text-left">
              <span
                className="inline-flex size-7 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
                style={{ backgroundColor: participant.color || '#64748b' }}
                aria-hidden
              >
                {participant.initialen || participantLabel(participant).slice(0, 2).toUpperCase()}
              </span>
              <span className="text-sm font-medium">{participantLabel(participant)}</span>
            </div>
            {days.map((datum) => (
              <div key={`${participant.id}-${datum}`} className="min-h-30 border-l p-1">
                <div className="grid grid-cols-2 gap-1">
                  {orderedDayparts.map((daypart) => {
                    const cell = { participant, datum, daypart };
                    const disabled = isCellDisabled?.(cell) ?? false;
                    return (
                      <button
                        key={`${participant.id}-${datum}-${daypart.id}`}
                        type="button"
                        disabled={disabled || !onCellClick}
                        onClick={() => onCellClick?.(cell)}
                        className="group/cell relative flex min-h-12 w-full items-center justify-center rounded border border-border/70 px-1 text-left text-[10px] enabled:cursor-pointer enabled:hover:border-primary/60 enabled:hover:bg-muted disabled:cursor-default disabled:opacity-80"
                        aria-label={`${participantLabel(participant)} ${datum} ${daypart.naam}`}
                      >
                        {isCellFilled?.(cell) ? null : (
                          <DaypartIcon
                            volgorde={daypart.volgorde}
                            className="pointer-events-none absolute size-7"
                          />
                        )}
                        <span className="relative z-10 flex h-full w-full min-w-0 items-center justify-center">
                          {renderCell(cell)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      </div>
      <PlannerCursorToolFollower tool={cursorTool ?? null} position={cursorPosition} />
    </div>
  );
}
