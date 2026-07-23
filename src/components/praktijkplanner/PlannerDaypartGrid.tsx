'use client';

import Image from 'next/image';
import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { weekDates } from '@/lib/praktijkplanner/dates';
import { cn } from '@/lib/utils';
import { getContrastTextColor } from '@/utils/contrastTextColor';
import type { PraktijkplannerDaypart, PraktijkplannerParticipant } from '@/types/praktijkplanner';
import {
  PlannerCursorToolFollower,
  UNAVAILABLE_DAYPART_CURSOR_TOOL,
  usePlannerCursorTool,
  type PlannerCursorTool,
} from './PlannerCursorTool';
import { PlannerWeekNavigation } from './PlannerWeekNavigation';
import { PLANNER_DAYPART_GRID_HEADER_HEIGHT_PX, PLANNER_GRID_NAV_MARGIN_PX, plannerWeekGridNavOffsetPx } from './planner-grid-layout';

export const UNAVAILABLE_DAYPART_TOAST =
  'Dit dagdeel is niet beschikbaar voor deze deelnemer/waarneemgroep';

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

/** Same format as lijst deelnemers: achternaam, voornaam, voorletterstussenvoegsel */
function participantLabel(participant: PraktijkplannerParticipant): string {
  return (
    [participant.achternaam, participant.voornaam, participant.voorletterstussenvoegsel]
      .filter(Boolean)
      .join(', ') ||
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
  return <Image src={icon} alt="" width={28} height={28} className={className ?? 'size-7'} />;
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
  isCellUnavailable,
  isCellFilled,
  holidayLabels,
  cursorTool,
  onCursorToolDismiss,
  renderParticipantActions,
  getCellClassName,
}: {
  participants: PraktijkplannerParticipant[];
  dayparts: PraktijkplannerDaypart[];
  weekStart: string;
  onWeekStartChange?: (weekStart: string) => void;
  zoom?: string | number;
  renderCell: (cell: PlannerDaypartCell) => ReactNode;
  onCellClick?: (cell: PlannerDaypartCell) => void;
  isCellDisabled?: (cell: PlannerDaypartCell) => boolean;
  /** Non-schedulable dayparts: always gray placeholder, never clickable, never show chips. */
  isCellUnavailable?: (cell: PlannerDaypartCell) => boolean;
  isCellFilled?: (cell: PlannerDaypartCell) => boolean;
  holidayLabels?: ReadonlyMap<string, string[]>;
  cursorTool?: PlannerCursorTool | null;
  onCursorToolDismiss?: () => void;
  renderParticipantActions?: (participant: PraktijkplannerParticipant) => ReactNode;
  getCellClassName?: (cell: PlannerDaypartCell) => string | undefined;
}) {
  const days = weekDates(weekStart);
  const orderedDayparts = [...dayparts].sort((a, b) => a.volgorde - b.volgorde);
  const gridRootRef = useRef<HTMLDivElement>(null);
  const [unavailableCursor, setUnavailableCursor] = useState<{ x: number; y: number } | null>(null);
  const cursorPosition = usePlannerCursorTool({
    active: cursorTool != null && unavailableCursor == null,
    containerRef: gridRootRef,
    onDismiss: onCursorToolDismiss,
  });

  const followerTool = unavailableCursor ? UNAVAILABLE_DAYPART_CURSOR_TOOL : cursorTool ?? null;
  const followerPosition = unavailableCursor ?? cursorPosition;

  const trackUnavailableCursor = (event: { clientX: number; clientY: number }) => {
    setUnavailableCursor({ x: event.clientX, y: event.clientY });
  };

  return (
    <div ref={gridRootRef}>
      <div className={cn('flex', renderParticipantActions && 'gap-1')}>
        {renderParticipantActions ? (
          <div className="flex w-fit shrink-0 flex-col">
            {onWeekStartChange ? (
              <div aria-hidden style={{ height: `${plannerWeekGridNavOffsetPx()}px` }} />
            ) : null}
            <div
              aria-hidden
              className="border-b border-transparent"
              style={{ height: `${PLANNER_DAYPART_GRID_HEADER_HEIGHT_PX}px` }}
            />
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex min-h-30 w-fit items-center justify-center border-b border-transparent last:border-b-0"
              >
                {renderParticipantActions(participant)}
              </div>
            ))}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
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
        <div
          className="grid grid-cols-[minmax(11rem,1fr)_repeat(7,minmax(9.5rem,1fr))] border-b bg-muted/40"
          style={{ height: `${PLANNER_DAYPART_GRID_HEADER_HEIGHT_PX}px` }}
        >
          <div className="flex h-full items-center justify-center px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Deelnemer
          </div>

          {days.map((date) => {
            const label = dayLabel(date);
            const holidays = holidayLabels?.get(date) ?? [];
            return (
              <div key={date} className="flex h-full flex-col justify-center overflow-hidden border-l px-3 py-2 text-center">
                <p className="truncate text-s font-semibold uppercase tracking-wide text-muted-foreground">
                  {label.weekday} {label.day}
                </p>
                {holidays.length > 0 ? (
                  <p className="mt-0.5 truncate text-[10px] font-medium text-rose-700" title={holidays.join(', ')}>
                    {holidays.join(', ')}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {participants.map((participant) => {
          const label = participantLabel(participant);
          return (
          <div
            key={participant.id}
            className="grid grid-cols-[minmax(11rem,1fr)_repeat(7,minmax(9.5rem,1fr))] border-b last:border-b-0"
          >
            <div className="flex min-h-30 items-center gap-2 p-3 text-left">
              <span
                className="inline-flex h-7 w-13 shrink-0 items-center justify-center rounded text-xs font-bold"
                style={{
                  backgroundColor: participant.color || '#64748b',
                  color: getContrastTextColor(participant.color || '#64748b'),
                }}
                aria-hidden
              >
                {participant.initialen || label.slice(0, 2).toUpperCase()}
              </span>
              <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug" title={label}>
                {label}
              </span>
            </div>
            {days.map((datum) => (
              <div key={`${participant.id}-${datum}`} className="flex min-h-30 items-stretch border-l p-1">
                <div className="grid h-full w-full min-w-30 grid-cols-2 gap-1">
                  {orderedDayparts.map((daypart) => {
                    const cell = { participant, datum, daypart };
                    const unavailable = isCellUnavailable?.(cell) ?? false;
                    const disabled = !unavailable && ((isCellDisabled?.(cell) ?? false) || !onCellClick);
                    const filled = !unavailable && (isCellFilled?.(cell) ?? false);
                    return (
                      <button
                        key={`${participant.id}-${datum}-${daypart.id}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (unavailable) {
                            toast.info(UNAVAILABLE_DAYPART_TOAST);
                            return;
                          }
                          onCellClick?.(cell);
                        }}
                        onPointerEnter={(event) => {
                          if (unavailable) trackUnavailableCursor(event);
                        }}
                        onPointerMove={(event) => {
                          if (unavailable) trackUnavailableCursor(event);
                        }}
                        onPointerLeave={() => {
                          if (unavailable) setUnavailableCursor(null);
                        }}
                        className={cn(
                          'group/cell relative flex h-full min-h-12 w-full rounded border text-left text-[10px] enabled:cursor-pointer enabled:hover:border-primary/60 enabled:hover:bg-muted disabled:cursor-default',
                          unavailable
                            ? 'cursor-none border-border/40 bg-muted/40 opacity-50'
                            : 'border-border/70 disabled:opacity-80',
                          filled ? 'items-stretch p-0.5' : 'items-center justify-center p-1',
                          !unavailable ? getCellClassName?.(cell) : undefined
                        )}
                        aria-label={`${participantLabel(participant)} ${datum} ${daypart.naam}${unavailable ? ' niet inplanbaar' : ''}`}
                      >
                        {!filled ? (
                          <DaypartIcon
                            volgorde={daypart.volgorde}
                            className="pointer-events-none absolute inset-0 m-auto size-7"
                          />
                        ) : null}
                        <span
                          className={cn(
                            'relative z-10 flex h-full w-full min-w-0',
                            filled ? 'items-stretch' : 'items-center justify-center'
                          )}
                        >
                          {unavailable ? null : renderCell(cell)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          );
        })}
      </div>
          </div>
        </div>
      </div>
      <PlannerCursorToolFollower tool={followerTool} position={followerPosition} />
    </div>
  );
}
