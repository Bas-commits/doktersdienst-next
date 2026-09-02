'use client';

import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useHuidigMoment } from '@/hooks/praktijkplanner/useHuidigMoment';
import { weekDates } from '@/lib/praktijkplanner/dates';
import { isoWeekdayFromDate } from '@/lib/praktijkplanner/schedulable-dayparts';
import { cn } from '@/lib/utils';
import { getContrastTextColor } from '@/utils/contrastTextColor';
import type { PraktijkplannerDaypart, PraktijkplannerParticipant } from '@/types/praktijkplanner';
import {
  PlannerCursorToolFollower,
  UNAVAILABLE_DAYPART_CURSOR_TOOL,
  usePlannerCursorTool,
  type PlannerCursorTool,
} from './PlannerCursorTool';
import { DaypartIcon } from './DaypartIcon';
import { PlannerWeekBar } from './PlannerWeekBar';
import { PLANNER_DAYPART_GRID_HEADER_HEIGHT_PX, PLANNER_GRID_NAV_MARGIN_PX } from './planner-grid-layout';

export const UNAVAILABLE_DAYPART_TOAST =
  'Dit dagdeel is niet beschikbaar voor deze deelnemer/waarneemgroep';

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
  verborgenWeekdagen,
  toonInhoudOpNietInplanbaar = false,
}: {
  participants: PraktijkplannerParticipant[];
  dayparts: PraktijkplannerDaypart[];
  weekStart: string;
  onWeekStartChange?: (weekStart: string) => void;
  zoom?: string | number;
  renderCell: (cell: PlannerDaypartCell) => ReactNode;
  onCellClick?: (cell: PlannerDaypartCell) => void;
  isCellDisabled?: (cell: PlannerDaypartCell) => boolean;
  /** Non-schedulable dayparts: always gray placeholder, never clickable. */
  isCellUnavailable?: (cell: PlannerDaypartCell) => boolean;
  isCellFilled?: (cell: PlannerDaypartCell) => boolean;
  holidayLabels?: ReadonlyMap<string, string[]>;
  cursorTool?: PlannerCursorTool | null;
  onCursorToolDismiss?: () => void;
  renderParticipantActions?: (participant: PraktijkplannerParticipant) => ReactNode;
  /** When set, participant names become clickable (e.g. open mijn gegevens). */
  onParticipantNameClick?: (participant: PraktijkplannerParticipant) => void;
  getCellClassName?: (cell: PlannerDaypartCell) => string | undefined;
  /** ISO-weekdagen (maandag is 1) die de groep nooit gebruikt en die dus geen kolom krijgen. */
  verborgenWeekdagen?: ReadonlySet<number>;
  /**
   * Toont wat er in een niet-inplanbaar vakje staat, in plaats van een leeg grijs vakje.
   *
   * Staat uit voor de planning: de eigenaar heeft op 12 augustus 2026 besloten dat oude planning
   * op een dagdeel dat de groep niet meer gebruikt weg mag blijven, en dat kost niemand iets.
   * Aan voor de afwezigheidsplanner, waar het wel iets kost: een afwezigheid die het scherm
   * verzwijgt telt gewoon mee in de jaarbalans, dus een saldo klopt dan niet met wat je ziet en
   * er is geen enkele manier om te achterhalen waarom. In Test10 stonden 39 van de 197
   * afwezigheden zo verstopt.
   */
  toonInhoudOpNietInplanbaar?: boolean;
}) {
  const days = weekDates(weekStart).filter(
    (datum) => !verborgenWeekdagen?.has(isoWeekdayFromDate(datum))
  );
  const orderedDayparts = [...dayparts].sort((a, b) => a.volgorde - b.volgorde);
  const huidigMoment = useHuidigMoment();
  const gridRootRef = useRef<HTMLDivElement>(null);
  const [unavailableCursor, setUnavailableCursor] = useState<{ x: number; y: number } | null>(null);
  const cursorPosition = usePlannerCursorTool({
    active: cursorTool != null && unavailableCursor == null,
    containerRef: gridRootRef,
    onDismiss: onCursorToolDismiss,
  });

  // Het aantal dagkolommen staat niet vast: dagen die de groep nooit gebruikt vallen weg. De
  // kopregel en elke deelnemersregel delen deze ene definitie, anders schuiven ze uit elkaar.
  const kolommen = `minmax(10rem,12rem) repeat(${days.length}, minmax(8rem,9rem))`;

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
      {/*
        De knoppen per deelnemer stonden hier in een eigen kolom links van het rooster, onder
        elkaar. Die kolom is weg: ze staan nu boven de naam, binnen de deelnemerskolom zelf.
        Dat scheelt de breedte van de kolom en de hoogte van vier knoppen op elkaar.
      */}
      <div className="flex w-fit min-w-full">
      {/*
        Geen vaste minimumbreedte meer: die hoorde bij zeven vaste dagkolommen. De kolommen
        dragen hun eigen ondergrens, dus met minder dagen krimpt het rooster mee.
      */}
      <div>
        {/*
          De kopregel blijft staan terwijl je door de deelnemers scrollt. Zonder dat weet je
          halverwege het rooster niet meer welke kolom welke dag is. De achtergrond is
          dekkend gemaakt: doorschijnend zie je de fiches eronder doorheen lopen.
        */}
        <div
          className="sticky top-0 z-30 grid border-b bg-card"
          style={{
            height: `${PLANNER_DAYPART_GRID_HEADER_HEIGHT_PX}px`,
            gridTemplateColumns: kolommen,
          }}
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
            className="grid snap-start border-b last:border-b-0"
            style={{ gridTemplateColumns: kolommen }}
          >
            <div className="flex min-h-20 flex-col justify-center gap-1 p-3 text-left">
              {renderParticipantActions ? (
                <div className="flex justify-start">{renderParticipantActions(participant)}</div>
              ) : null}
              <div className="flex items-center gap-2">
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
            </div>
            {days.map((datum) => (
              <div key={`${participant.id}-${datum}`} className="flex items-stretch border-l p-1">
                {/*
                  De hoogte van de regel volgt uit de vakjes, niet andersom. Met een vaste
                  hoogte werd een vakje een liggende balk zodra avond en nacht erbij kwamen,
                  en een staande balk zodra ze weer weg waren.
                */}
                <div className="mx-auto grid w-fit grid-cols-2 gap-1">
                  {orderedDayparts.map((daypart) => {
                    const cell = { participant, datum, daypart };
                    const unavailable = isCellUnavailable?.(cell) ?? false;
                    const disabled = !unavailable && ((isCellDisabled?.(cell) ?? false) || !onCellClick);
                    const toontInhoud = !unavailable || toonInhoudOpNietInplanbaar;
                    const filled = toontInhoud && (isCellFilled?.(cell) ?? false);
                    /*
                      Een niet-inplanbaar vakje waar toch iets in staat mag aangeklikt worden, want
                      anders is het wel te zien en niet weg te halen. Wat er dan gebeurt bepaalt de
                      aanroeper: de afwezigheidsplanner laat alleen wissen toe, niet neerzetten.
                    */
                    const opruimbaar = unavailable && filled;
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
                          if (unavailable && !opruimbaar) {
                            toast.info(UNAVAILABLE_DAYPART_TOAST);
                            return;
                          }
                          onCellClick?.(cell);
                        }}
                        onPointerEnter={(event) => {
                          if (unavailable && !opruimbaar) trackUnavailableCursor(event);
                        }}
                        onPointerMove={(event) => {
                          if (unavailable && !opruimbaar) trackUnavailableCursor(event);
                        }}
                        onPointerLeave={() => {
                          if (unavailable && !opruimbaar) setUnavailableCursor(null);
                        }}
                        className={cn(
                          // Vast vierkant van 56 pixels, niet een deel van de kolombreedte.
                          // Meerekenen met de kolom maakte een fiche groter zonder dat er meer
                          // in kwam te staan, en liet de ruimte die overbleef als lucht tussen
                          // de twee vakjes vallen. 56 is gekozen omdat twee vakjes onder elkaar
                          // de regel even hoog houden als hij was met een vaste regelhoogte,
                          // zodat avond en nacht erbij zetten geen ruimte kost.
                          'group/cell relative flex size-14 rounded-md border text-left text-[10px] enabled:cursor-pointer enabled:hover:border-primary/60 enabled:hover:bg-muted disabled:cursor-default',
                          unavailable
                            ? opruimbaar
                              ? // Wel grijs, maar met een streepjesrand: dit vakje hoort hier niet
                                // te staan en kan weg. Zonder de dode cursor, want er valt te
                                // klikken.
                                'border-dashed border-destructive/50 bg-muted/40 opacity-70'
                              : 'cursor-none border-border/40 bg-muted/40 opacity-50'
                            : 'border-border/70 disabled:opacity-80',
                          filled ? 'items-stretch' : 'items-center justify-center p-1',
                          isNu ? 'ring-2 ring-inset ring-emerald-600' : '',
                          !unavailable ? getCellClassName?.(cell) : undefined
                        )}
                        aria-label={`${participantLabel(participant)} ${datum} ${daypart.naam}${
                          unavailable
                            ? opruimbaar
                              ? ' niet inplanbaar, klik om weg te halen'
                              : ' niet inplanbaar'
                            : ''
                        }`}
                      >
                        {/*
                          Zelfde achtergrond als op het scherm van de dokter: de letter van het
                          dagdeel in de hoek en het icoon eronder wat kleiner en lichter. Het
                          icoon stond hier op volle sterkte en was daarmee net zo opvallend als
                          wat er in het vakje gepland staat, terwijl het alleen zegt welk dagdeel
                          het is.
                        */}
                        <span className="absolute top-0.5 left-1 text-[8px] text-muted-foreground">
                          {daypart.naam.slice(0, 1)}
                        </span>
                        {!filled ? (
                          <DaypartIcon
                            volgorde={daypart.volgorde}
                            className="pointer-events-none absolute inset-0 m-auto size-6 opacity-60"
                          />
                        ) : null}
                        <span
                          className={cn(
                            'relative z-10 flex h-full w-full min-w-0',
                            filled ? 'items-stretch' : 'items-center justify-center'
                          )}
                        >
                          {toontInhoud ? renderCell(cell) : null}
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
