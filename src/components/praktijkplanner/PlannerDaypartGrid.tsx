'use client';

import Image from 'next/image';
import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useHuidigMoment } from '@/hooks/praktijkplanner/useHuidigMoment';
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
import { PlannerWeekBar } from './PlannerWeekBar';
import { PLANNER_DAYPART_GRID_HEADER_HEIGHT_PX, PLANNER_GRID_NAV_MARGIN_PX } from './planner-grid-layout';

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

function expertiseLabel(expertise: { naam: string; afkorting: string | null }): string {
  return expertise.afkorting?.trim() || expertise.naam;
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
  onParticipantNameClick,
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
  /** When set, participant names become clickable (e.g. open mijn gegevens). */
  onParticipantNameClick?: (participant: PraktijkplannerParticipant) => void;
  getCellClassName?: (cell: PlannerDaypartCell) => string | undefined;
}) {
  const days = weekDates(weekStart);
  const orderedDayparts = [...dayparts].sort((a, b) => a.volgorde - b.volgorde);
  const huidigMoment = useHuidigMoment();
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
    <div ref={gridRootRef} className="flex min-h-0 flex-1 flex-col">
      {/*
        Alle schermen zetten hun weeknavigatie in de paginakop en geven onWeekStartChange dus
        niet mee. Alleen de kopieer-popup heeft geen paginakop en houdt de balk hier.
      */}
      {onWeekStartChange ? (
        <div style={{ paddingBottom: `${PLANNER_GRID_NAV_MARGIN_PX}px` }}>
          <div className="ml-44">
            <PlannerWeekBar weekStart={weekStart} onWeekStartChange={onWeekStartChange} />
          </div>
        </div>
      ) : null}
      <div className={cn('flex min-h-0 flex-1', renderParticipantActions && 'gap-1')}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/*
            Het rooster scrollt zelf, in plaats van de hele pagina. Alleen zo kan de kopregel
            met DEELNEMER en de dagen blijven staan: die zat in een vakje dat alleen
            horizontaal scrollde, en daarbinnen heeft vastzetten geen effect. De knoppen per
            deelnemer staan nu binnen hetzelfde vakje, anders lopen ze niet meer mee.

            Zonder hoogte van de ouder valt dit terug op het oude gedrag: het vakje groeit
            mee met de inhoud en de pagina scrollt.
          */}
          <div
            // De ondergrens houdt het rooster bruikbaar op een laag venster. Past het dan
            // niet meer, dan scrollt de pagina eromheen zoals vroeger.
            className="min-h-80 flex-1 snap-y snap-mandatory overflow-auto rounded-xl border bg-card shadow-sm"
            style={{
              ...(zoom ? { zoom: `${zoom}%` } : {}),
              // Scrollen stopt op een deelnemersregel, nooit halverwege een regel. De
              // opvulling houdt daarbij rekening met de kopregel die bovenaan blijft staan;
              // zonder dat legt de kop de bovenkant van de regel waar je op stopt weer af.
              scrollPaddingTop: `${PLANNER_DAYPART_GRID_HEADER_HEIGHT_PX}px`,
            }}
          >
      <div className={cn('flex w-fit min-w-full', renderParticipantActions && 'gap-1')}>
        {renderParticipantActions ? (
          <div className="sticky left-0 z-40 flex w-fit shrink-0 flex-col bg-card">
            {/*
              Dit blok staat op de hoogte van de kopregel en blijft daar staan. De kopregel
              zelf loopt niet door over deze kolom, dus zonder dit blok schoven de knoppen
              van de bovenste deelnemers gewoon naast DEELNEMER in beeld.
            */}
            <div
              aria-hidden
              className="sticky top-0 z-10 border-b border-transparent bg-card"
              style={{ height: `${PLANNER_DAYPART_GRID_HEADER_HEIGHT_PX}px` }}
            />
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex min-h-30 w-fit snap-start items-center justify-center border-b border-transparent last:border-b-0"
              >
                {renderParticipantActions(participant)}
              </div>
            ))}
          </div>
        ) : null}
      <div className="min-w-[1120px]">
        {/*
          De kopregel blijft staan terwijl je door de deelnemers scrollt. Zonder dat weet je
          halverwege het rooster niet meer welke kolom welke dag is. De achtergrond is
          dekkend gemaakt: doorschijnend zie je de fiches eronder doorheen lopen.
        */}
        <div
          className="sticky top-0 z-30 grid grid-cols-[minmax(11rem,1fr)_repeat(7,minmax(9.5rem,1fr))] border-b bg-card"
          style={{ height: `${PLANNER_DAYPART_GRID_HEADER_HEIGHT_PX}px` }}
        >
          <div className="flex h-full items-center justify-center px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Deelnemer
          </div>

          {days.map((date) => {
            const label = dayLabel(date);
            const holidays = holidayLabels?.get(date) ?? [];
            const isVandaag = date === huidigMoment?.datum;
            return (
              <div key={date} className="flex h-full flex-col justify-center overflow-hidden border-l px-3 py-2 text-center">
                <p
                  className={cn(
                    'truncate text-s font-semibold uppercase tracking-wide',
                    isVandaag ? 'text-emerald-600' : 'text-muted-foreground'
                  )}
                >
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
          const expertises = participant.expertises ?? [];
          return (
          <div
            key={participant.id}
            className="grid snap-start grid-cols-[minmax(11rem,1fr)_repeat(7,minmax(9.5rem,1fr))] border-b last:border-b-0"
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
              <div className="min-w-0 flex-1">
                {onParticipantNameClick ? (
                  <button
                    type="button"
                    className="line-clamp-2 w-full cursor-pointer text-left text-sm font-medium leading-snug text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={`Open gegevens van ${label}`}
                    onClick={() => onParticipantNameClick(participant)}
                  >
                    {label}
                  </button>
                ) : (
                  <span className="line-clamp-2 text-sm font-medium leading-snug" title={label}>
                    {label}
                  </span>
                )}
                {expertises.length > 0 ? (
                  <p
                    className="mt-1 text-[11px] leading-snug text-muted-foreground"
                    title={expertises.map((expertise) => expertise.naam).join(', ')}
                  >
                    {expertises.map((expertise) => expertiseLabel(expertise)).join(', ')}
                  </p>
                ) : null}
              </div>
            </div>
            {days.map((datum) => (
              <div key={`${participant.id}-${datum}`} className="flex min-h-30 items-stretch border-l p-1">
                <div className="grid h-full w-full min-w-30 grid-cols-2 gap-1">
                  {orderedDayparts.map((daypart) => {
                    const cell = { participant, datum, daypart };
                    const unavailable = isCellUnavailable?.(cell) ?? false;
                    const disabled = !unavailable && ((isCellDisabled?.(cell) ?? false) || !onCellClick);
                    const filled = !unavailable && (isCellFilled?.(cell) ?? false);
                    // Het dagdeel waar de klok nu in staat, op de dag van vandaag. Een rand
                    // en geen vulling: in het vakje staat een fiche die zichtbaar moet blijven.
                    const isNu =
                      datum === huidigMoment?.datum && daypart.volgorde === huidigMoment.volgorde;
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
                          isNu ? 'ring-2 ring-inset ring-emerald-600' : '',
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
      </div>
      <PlannerCursorToolFollower tool={followerTool} position={followerPosition} />
    </div>
  );
}
