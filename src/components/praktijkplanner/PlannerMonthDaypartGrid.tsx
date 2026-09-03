'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useHuidigMoment } from '@/hooks/praktijkplanner/useHuidigMoment';
import {
  datesBetweenInclusive,
  monthCalendarBounds,
  weekdayFromIsoDate,
} from '@/lib/praktijkplanner/dates';
import { tijdLabels } from '@/lib/praktijkplanner/daypart-times';
import type {
  PraktijkplannerDaypart,
  PraktijkplannerDaypartTime,
  PraktijkplannerParticipant,
} from '@/types/praktijkplanner';
import type { PlannerDaypartCell } from './PlannerDaypartGrid';
import { UNAVAILABLE_DAYPART_TOAST } from './PlannerDaypartGrid';
import {
  PlannerCursorToolFollower,
  UNAVAILABLE_DAYPART_CURSOR_TOOL,
  usePlannerCursorTool,
  type PlannerCursorTool,
} from './PlannerCursorTool';

const WEEKDAYS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

/** Display order left-to-right, top-to-bottom: Ochtend, Middag, Avond, Nacht. */
const DAYPART_SEQUENCE = ['Ochtend', 'Middag', 'Avond', 'Nacht'] as const;

function compareDayparts(a: PraktijkplannerDaypart, b: PraktijkplannerDaypart): number {
  const ai = DAYPART_SEQUENCE.indexOf(a.naam as (typeof DAYPART_SEQUENCE)[number]);
  const bi = DAYPART_SEQUENCE.indexOf(b.naam as (typeof DAYPART_SEQUENCE)[number]);
  if (ai !== -1 && bi !== -1) return ai - bi;
  return a.volgorde - b.volgorde;
}

export function PlannerMonthDaypartGrid({
  participant,
  dayparts,
  year,
  month,
  renderCell,
  onCellClick,
  onCellPointerEnter,
  isCellDisabled,
  isCellFilled,
  daypartTimes,
  isCellUnavailable,
  holidayLabels,
  blockedDates,
  renderBlockedCell,
  cursorTool,
  onCursorToolDismiss,
  verborgenWeekdagen,
  toonInhoudOpNietInplanbaar = false,
}: {
  participant: PraktijkplannerParticipant;
  dayparts: PraktijkplannerDaypart[];
  year: number;
  month: number;
  renderCell: (cell: PlannerDaypartCell) => ReactNode;
  onCellClick?: (cell: PlannerDaypartCell) => void;
  onCellPointerEnter?: (cell: PlannerDaypartCell, event: PointerEvent<HTMLButtonElement>) => void;
  isCellDisabled?: (cell: PlannerDaypartCell) => boolean;
  /**
   * Of er iets in het vakje staat. Alleen nodig om te weten of het ballonnetje met de tijd van
   * het dagdeel er wel of niet bij mag: bij een gevuld vakje hangt er al een eigen voorbeeld
   * aan de muis.
   */
  isCellFilled?: (cell: PlannerDaypartCell) => boolean;
  /** De tijden per dagdeel uit Plannerbeheer, voor dat ballonnetje. */
  daypartTimes?: PraktijkplannerDaypartTime[];
  isCellUnavailable?: (cell: PlannerDaypartCell) => boolean;
  holidayLabels?: ReadonlyMap<string, string[]>;
  blockedDates?: ReadonlySet<string>;
  renderBlockedCell?: (cell: PlannerDaypartCell) => ReactNode;
  cursorTool?: PlannerCursorTool | null;
  onCursorToolDismiss?: () => void;
  /** ISO-weekdagen die de groep nooit gebruikt. Zie weekdagenZonderRooster. */
  verborgenWeekdagen?: ReadonlySet<number>;
  /** Zie dezelfde vlag op PlannerDaypartGrid: een verstopte afwezigheid kost een saldo. */
  toonInhoudOpNietInplanbaar?: boolean;
}) {
  const bounds = monthCalendarBounds(year, month);
  const gridRootRef = useRef<HTMLDivElement>(null);
  const [unavailableCursor, setUnavailableCursor] = useState<{ x: number; y: number } | null>(null);
  const cursorPosition = usePlannerCursorTool({
    active: cursorTool != null && unavailableCursor == null,
    containerRef: gridRootRef,
    onDismiss: onCursorToolDismiss,
  });
  /*
    De tijden een keer opzoeken en niet per vakje: een rooster tekent er honderden.
  */
  const dagdeelTijden = tijdLabels(daypartTimes ?? []);
  const huidigMoment = useHuidigMoment();
  if (!bounds) return null;

  // Kop en cellen filteren op dezelfde regel, anders staat een dag onder de verkeerde naam.
  // De kalender begint altijd op maandag, dus de rijen blijven kloppen als er een dag uitvalt.
  const zichtbareWeekdagen = [1, 2, 3, 4, 5, 6, 7].filter(
    (weekdag) => !verborgenWeekdagen?.has(weekdag)
  );
  const dates = datesBetweenInclusive(bounds.start, bounds.end).filter(
    (datum) => !verborgenWeekdagen?.has(weekdayFromIsoDate(datum))
  );
  const orderedDayparts = [...dayparts].sort(compareDayparts);
  const followerTool = unavailableCursor ? UNAVAILABLE_DAYPART_CURSOR_TOOL : cursorTool ?? null;
  const followerPosition = unavailableCursor ?? cursorPosition;

  const trackUnavailableCursor = (event: { clientX: number; clientY: number }) => {
    setUnavailableCursor({ x: event.clientX, y: event.clientY });
  };

  return (
    <div ref={gridRootRef}>
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <div style={{ minWidth: `${zichtbareWeekdagen.length * 128}px` }}>
        <div
          className="grid border-b bg-muted/40"
          style={{ gridTemplateColumns: `repeat(${zichtbareWeekdagen.length}, minmax(0,1fr))` }}
        >
          {zichtbareWeekdagen.map((weekdag) => (
            <div
              key={weekdag}
              className="p-2 text-center text-xs font-semibold text-muted-foreground"
            >
              {WEEKDAYS[weekdag - 1]}
            </div>
          ))}
        </div>
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${zichtbareWeekdagen.length}, minmax(0,1fr))` }}
        >
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
                  datum === huidigMoment?.datum ? 'ring-2 ring-inset ring-emerald-600' : '',
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
                    // De dag had al een groene rand, het dagdeel nog niet. Zonder dat weet je
                    // wel welke dag het is, maar niet waar in die dag je staat.
                    const isNu =
                      datum === huidigMoment?.datum && daypart.volgorde === huidigMoment.volgorde;
                    const unavailable = isCellUnavailable?.(cell) ?? false;
                    /*
                      Een niet-inplanbaar vakje blijft aanklikbaar, want wat er toch in staat
                      moet eruit kunnen. Dat gold ook voor isCellDisabled, en daarmee bleven op
                      het dokterscherm juist de vakjes uit het verleden aanklikbaar waar iets in
                      stond. Een vakje dat de aanroeper uitzet gaat nu voor; alleen de
                      feestdagsluiting houdt zijn uitzondering.
                    */
                    const disabled =
                      isCellDisabled?.(cell) || !onCellClick || (!unavailable && blocked);
                    const inhoud =
                      !unavailable || toonInhoudOpNietInplanbaar
                        ? blocked
                          ? renderBlockedCell?.(cell) ?? renderCell(cell)
                          : renderCell(cell)
                        : null;
                    // Staat er toch iets in een niet-inplanbaar vakje, dan moet het weg kunnen.
                    const opruimbaar = unavailable && inhoud != null;
                    return (
                      <button
                        key={`${datum}-${daypart.id}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (unavailable && !opruimbaar) {
                            toast.info(UNAVAILABLE_DAYPART_TOAST);
                            return;
                          }
                          onCellClick?.(cell);
                        }}
                        onPointerEnter={(event) => {
                          if (unavailable && !opruimbaar) {
                            trackUnavailableCursor(event);
                            return;
                          }
                          onCellPointerEnter?.(cell, event);
                        }}
                        onPointerMove={(event) => {
                          if (unavailable && !opruimbaar) trackUnavailableCursor(event);
                        }}
                        onPointerLeave={() => {
                          if (unavailable && !opruimbaar) setUnavailableCursor(null);
                        }}
                        className={[
                          'group/cell relative flex min-h-12 w-full items-center justify-center rounded-md border text-left text-[10px] enabled:cursor-pointer enabled:hover:border-primary/60 enabled:hover:bg-muted disabled:cursor-default',
                          unavailable
                            ? opruimbaar
                              ? 'border-dashed border-destructive/50 bg-muted/40 opacity-70'
                              : 'cursor-none border-border/40 bg-muted/40 opacity-50'
                            : 'border-border/70 disabled:opacity-80',
                          isNu ? 'ring-2 ring-inset ring-emerald-600' : '',
                        ].join(' ')}
                        title={
                          isCellFilled?.(cell)
                            ? undefined
                            : dagdeelTijden.get(daypart.id)
                        }
                        aria-label={`${datum} ${daypart.naam}${unavailable ? ' niet inplanbaar' : ''}${blocked ? ' feestdag' : ''}`}
                      >
                        <span className="absolute top-0.5 left-1 text-[8px] text-muted-foreground">
                          {daypart.naam.slice(0, 1)}
                        </span>
                        {/*
                          Een blok met een echte hoogte, geen inline span. Een afwezigheidstegel
                          rekent zijn maat uit als honderd procent van zijn ouder, en honderd
                          procent van een inline span is nul. Wat er dan overbleef was de
                          opvulling van het gekleurde randje: een bolletje van zes pixels in de
                          kleur van de deelnemer, met het rode vlak en het icoon op nul.
                        */}
                        <span className="block h-full w-full min-w-0 max-w-full">{inhoud}</span>
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
    <PlannerCursorToolFollower tool={followerTool} position={followerPosition} />
    </div>
  );
}
