'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';
import { dienstvoorkeurKleur, dienstvoorkeurLabel } from './PlannerDienstvoorkeurMark';
import { absentieTekst } from '@/lib/praktijkplanner/absentie-tekst';
import { afwijkingTekst, herhalingWeekLabel } from '@/lib/praktijkplanner/herhaling-tekst';
import { cn } from '@/lib/utils';
import type { PraktijkplannerDienstvoorkeurWaarde } from '@/types/praktijkplanner';

const CURSOR_GAP = 50;
const VIEWPORT_PAD = 8;

type HoverPosition = { x: number; y: number };

function placeNearCursor(
  cursor: HoverPosition,
  width: number,
  height: number
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const candidates: Array<{ left: number; top: number }> = [
    // right
    { left: cursor.x + CURSOR_GAP, top: cursor.y - height / 2 },
    // left
    { left: cursor.x - CURSOR_GAP - width, top: cursor.y - height / 2 },
    // below
    { left: cursor.x - width / 2, top: cursor.y + CURSOR_GAP },
    // above
    { left: cursor.x - width / 2, top: cursor.y - CURSOR_GAP - height },
  ];

  for (const candidate of candidates) {
    const fitsX =
      candidate.left >= VIEWPORT_PAD && candidate.left + width <= vw - VIEWPORT_PAD;
    const fitsY =
      candidate.top >= VIEWPORT_PAD && candidate.top + height <= vh - VIEWPORT_PAD;
    if (fitsX && fitsY) {
      return {
        left: candidate.left,
        top: Math.min(
          Math.max(candidate.top, VIEWPORT_PAD),
          vh - VIEWPORT_PAD - height
        ),
      };
    }
  }

  // Fallback: clamp preferred right placement into the viewport
  return {
    left: Math.min(
      Math.max(cursor.x + CURSOR_GAP, VIEWPORT_PAD),
      Math.max(VIEWPORT_PAD, vw - VIEWPORT_PAD - width)
    ),
    top: Math.min(
      Math.max(cursor.y - height / 2, VIEWPORT_PAD),
      Math.max(VIEWPORT_PAD, vh - VIEWPORT_PAD - height)
    ),
  };
}

function formatDateLabel(datum: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${datum}T12:00:00`));
}

export function PlannerDaypartHoverPreview({
  enabled,
  participantName,
  initials,
  datum,
  daypartName,
  fromRepetition,
  isException,
  recurrenceSourceWeek,
  activityName,
  locationName,
  absence,
  dienstvoorkeur,
  availabilityName,
  taskNames,
  opmerking,
  showPlanningDetails = true,
  showParticipant = true,
  chip,
  children,
}: {
  enabled: boolean;
  participantName: string;
  initials: string;
  datum: string;
  daypartName: string;
  fromRepetition: boolean;
  isException: boolean;
  /** Maandag van de week waarvan herhaald is; null bij herhalingen van voor die kolom. */
  recurrenceSourceWeek?: string | null;
  /**
   * De activiteit voluit, dus de naam en niet de afkorting die op de fiche staat. Op de fiche
   * is er plek voor een paar tekens, hier is er plek voor de hele naam en heeft de planner er
   * ook iets aan.
   */
  activityName?: string | null;
  locationName?: string | null;
  /**
   * De absentie op dit dagdeel, met de naam van het type en of hij nog een aanvraag is. Eén
   * veld en geen twee vlaggen, want aangevraagd en goedgekeurd sluiten elkaar uit.
   */
  absence?: { type: string | null; aangevraagd: boolean } | null;
  /** De dienstvoorkeur op dit dagdeel. Staat los van de afwezigheid; beide kunnen er zijn. */
  dienstvoorkeur?: { waarde: PraktijkplannerDienstvoorkeurWaarde; aangevraagd: boolean } | null;
  availabilityName?: string | null;
  /**
   * De taken voluit: de omschrijving van elk taaktype, niet de afkorting.
   *
   * Met het nummer erbij als de taak inbelbaar is en er een nummer is ingevuld. Op de fiche
   * zelf past dat niet: de taakband is daar negen pixels tekst hoog en er kunnen drie taken in
   * een cel staan. Hier is de ruimte er wel, en wie wil bellen kijkt toch eerst wie er zit.
   */
  taskNames?: Array<{ naam: string; inbelnummer?: string | null }>;
  /** De vrije tekst die de planner bij deze fiche zette. Op de fiche staat alleen een paperclip. */
  opmerking?: string | null;
  /**
   * Uit op een dagdeel dat alleen een absentieaanvraag is. Activiteit, locatie, herhaling en
   * taken zijn daar per definitie leeg, en vier regels met een streepje zeggen niets.
   */
  showPlanningDetails?: boolean;
  /** Uit in een scherm dat maar één deelnemer toont; die naam herhalen zegt niets. */
  showParticipant?: boolean;
  chip: ReactNode;
  children: ReactNode;
}) {
  // Alleen de taken waar echt een nummer bij staat. Inbelbaar zonder nummer levert geen regel
  // op; het telefoonicoontje op de fiche zegt dan al wat er te zeggen valt.
  const inbelnummers = (taskNames ?? []).filter(
    (taak): taak is { naam: string; inbelnummer: string } => Boolean(taak.inbelnummer)
  );
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<HoverPosition | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const delayRef = useRef<number | null>(null);

  useEffect(() => {
    if (enabled) return;
    setOpen(false);
    setCursor(null);
    setCoords(null);
    if (delayRef.current != null) {
      window.clearTimeout(delayRef.current);
      delayRef.current = null;
    }
  }, [enabled]);

  useLayoutEffect(() => {
    if (!open || !cursor || !popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    setCoords(placeNearCursor(cursor, rect.width, rect.height));
  }, [
    open,
    cursor,
    chip,
    participantName,
    daypartName,
    activityName,
    locationName,
    absence,
  ]);

  useEffect(() => {
    return () => {
      if (delayRef.current != null) window.clearTimeout(delayRef.current);
    };
  }, []);

  return (
    <>
      <div
        className="h-full w-full min-w-0"
        onMouseEnter={(event) => {
          if (!enabled) return;
          if (delayRef.current != null) window.clearTimeout(delayRef.current);
          const point = { x: event.clientX, y: event.clientY };
          delayRef.current = window.setTimeout(() => {
            setCursor(point);
            setOpen(true);
          }, 120);
        }}
        onMouseMove={(event) => {
          if (!enabled) return;
          setCursor({ x: event.clientX, y: event.clientY });
        }}
        onMouseLeave={() => {
          if (delayRef.current != null) {
            window.clearTimeout(delayRef.current);
            delayRef.current = null;
          }
          setOpen(false);
          setCursor(null);
          setCoords(null);
        }}
      >
        {children}
      </div>
      {enabled && open && cursor && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popupRef}
              className={cn(
                // Breder dan de rest van de kaart nodig heeft, want activiteit en taken staan
                // hier voluit naast hun label. Bij de oude breedte bleef er voor de waarde te
                // weinig over en viel een omschrijving als Supervisie verpleegafdeling
                // Leidserijn Oncologie in losse stukjes uiteen.
                'pointer-events-none fixed z-[110] w-80 rounded-xl border bg-background p-3 shadow-xl',
                isException && 'border-amber-400'
              )}
              style={{
                left: coords?.left ?? cursor.x + CURSOR_GAP,
                top: coords?.top ?? cursor.y + CURSOR_GAP,
                visibility: coords ? 'visible' : 'hidden',
              }}
              role="tooltip"
            >
              <div className="mx-auto mb-3 h-28 w-44 pb-2">{chip}</div>
              <dl className="mt-3 space-y-1.5 text-xs">
                {showParticipant ? (
                  <>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Naam</dt>
                      <dd className="text-right font-medium">{participantName}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Initialen</dt>
                      <dd className="font-medium">{initials || '—'}</dd>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Datum / dagdeel</dt>
                  <dd className="text-right font-medium">
                    {formatDateLabel(datum)} · {daypartName}
                  </dd>
                </div>
                {showPlanningDetails ? (
                  <>
                    <div className="flex justify-between gap-2">
                      <dt className="shrink-0 text-muted-foreground">Activiteit</dt>
                      <dd className="text-right font-medium" data-testid="hover-activiteit">
                        {activityName || '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Locatie</dt>
                      <dd className="text-right font-medium">{locationName || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Herhaling</dt>
                      <dd className="text-right font-medium" data-testid="hover-herhaling">
                        {fromRepetition
                          ? recurrenceSourceWeek
                            ? `Ja, van week ${herhalingWeekLabel(recurrenceSourceWeek)}`
                            : 'Ja'
                          : 'Nee'}
                      </dd>
                    </div>
                  </>
                ) : null}
                {/*
                  Het bordje op de fiche zegt alleen dat er iets afwijkt. Hier hoort te staan
                  waarom het er staat en van welke week is afgeweken, anders moet de planner
                  dat zelf uitzoeken.
                */}
                {isException ? (
                  <div
                    className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-amber-700"
                    data-testid="hover-afwijking"
                  >
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="font-medium">
                      {afwijkingTekst(recurrenceSourceWeek ?? null)}
                    </span>
                  </div>
                ) : null}
                {showPlanningDetails ? (
                  <div className="flex justify-between gap-2">
                    <dt className="shrink-0 text-muted-foreground">
                      {taskNames && taskNames.length > 1 ? 'Taken' : 'Taak'}
                    </dt>
                    <dd className="text-right font-medium" data-testid="hover-taken">
                      {taskNames && taskNames.length > 0
                        ? // Elke taak op zijn eigen regel. Achter elkaar met een komma ertussen
                          // lopen twee volledige omschrijvingen in elkaar over.
                          taskNames.map((taak, index) => (
                            <p key={`${taak.naam}-${index}`}>{taak.naam}</p>
                          ))
                        : '—'}
                    </dd>
                  </div>
                ) : null}
                {/*
                  Een eigen regel, net als Taak. Achter de taaknaam geplakt loopt een nummer
                  van twaalf tekens vast met een omschrijving als Extern consult oncologie.

                  De taaknaam staat er alleen bij als er meer dan een nummer is. Bij een enkel
                  nummer staat de taak al op de regel erboven en zou de naam er twee keer staan.
                */}
                {inbelnummers.length > 0 ? (
                  <div className="flex justify-between gap-2">
                    <dt className="shrink-0 text-muted-foreground">Inbellen</dt>
                    <dd className="text-right font-medium" data-testid="hover-inbellen">
                      {inbelnummers.map((taak, index) => (
                        <p key={`${taak.naam}-${index}`}>
                          {inbelnummers.length > 1 ? `${taak.naam} ` : ''}
                          {taak.inbelnummer}
                        </p>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {availabilityName ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Beschikbaarheid</dt>
                    <dd className="text-right font-medium">{availabilityName}</dd>
                  </div>
                ) : null}
                {/*
                  Onder de regels, niet ertussen. De paperclip op de fiche zegt alleen dat er
                  iets staat; dit is de enige plek waar het te lezen valt, en vrije tekst van
                  een planner past niet in een regel van naam en waarde.
                */}
                {opmerking ? (
                  <div
                    className="rounded-md bg-muted p-2 whitespace-pre-wrap"
                    data-testid="hover-opmerking"
                  >
                    {opmerking}
                  </div>
                ) : null}
                {/*
                  Het vraagteken op de fiche zegt alleen dat er iets is aangevraagd. Hier hoort
                  te staan wat er is aangevraagd en dat het nog niet vaststaat, net als bij het
                  driehoekje hierboven.
                */}
                {absence ? (
                  <div
                    className="flex items-start gap-1.5 rounded-md bg-muted p-2"
                    data-testid="hover-absentie"
                  >
                    {absence.aangevraagd ? (
                      <span
                        className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded bg-background text-[10px] leading-none font-bold ring-1 ring-border"
                        aria-hidden
                      >
                        ?
                      </span>
                    ) : null}
                    <span className="font-medium">
                      {absentieTekst(absence.type, absence.aangevraagd)}
                    </span>
                  </div>
                ) : null}
                {dienstvoorkeur ? (
                  <div
                    className="flex items-start gap-1.5 rounded-md bg-muted p-2"
                    data-testid="hover-dienstvoorkeur"
                  >
                    <span
                      className="mt-0.5 size-3.5 shrink-0 rounded"
                      style={{
                        background: dienstvoorkeurKleur(
                          dienstvoorkeur.waarde,
                          dienstvoorkeur.aangevraagd
                        ),
                      }}
                      aria-hidden
                    />
                    <span className="font-medium">
                      {dienstvoorkeurLabel(dienstvoorkeur.waarde, dienstvoorkeur.aangevraagd)}
                    </span>
                  </div>
                ) : null}
              </dl>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
