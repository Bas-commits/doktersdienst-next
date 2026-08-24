'use client';

import { type ReactNode } from 'react';
import { useHuidigMoment } from '@/hooks/praktijkplanner/useHuidigMoment';
import {
  datesBetweenInclusive,
  isoWeekNumber,
  monthBounds,
  weekdayFromIsoDate,
} from '@/lib/praktijkplanner/dates';
import type { PraktijkplannerDaypart, PraktijkplannerParticipant } from '@/types/praktijkplanner';
import { MAAND_CEL_STANDAARD } from '@/lib/praktijkplanner/maand-celgrootte';
import type { PlannerDaypartCell } from './PlannerDaypartGrid';

const WEEKDAG_LETTERS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

const NAAM_BREEDTE_PX = 176;
const DAGDEEL_BREEDTE_PX = 24;

/** Achternaam eerst, net als in de weekweergave en in de lijst deelnemers. */
function deelnemerNaam(participant: PraktijkplannerParticipant): string {
  return [participant.achternaam, participant.voornaam].filter(Boolean).join(', ');
}

function weekGroepen(dates: string[]): Array<{ week: number; dagen: number }> {
  const groepen: Array<{ week: number; dagen: number }> = [];
  for (const datum of dates) {
    const week = isoWeekNumber(datum);
    const laatste = groepen[groepen.length - 1];
    if (laatste && laatste.week === week) laatste.dagen += 1;
    else groepen.push({ week, dagen: 1 });
  }
  return groepen;
}

/**
 * De hele maand naast elkaar: deelnemers onder elkaar, één smalle kolom per dag.
 *
 * De weekweergave zet de vier dagdelen als fiches in een blokje van twee bij twee, ongeveer
 * 187 pixels per dag. Een maand in die vorm is ruim 5800 pixels breed en past op geen enkel
 * scherm. Daarom staat hier per dag maar één kolom en krijgt elk dagdeel een eigen rij onder
 * de deelnemer.
 *
 * In die kolom staat dezelfde fiche als in de week, alleen kleiner getekend: de fiches zijn
 * wat een planner afleest, dus een letter in plaats daarvan haalt de maand leeg. Zie de
 * dichtheid `micro` in PlannerCombinedDaypartChip voor wat er bij 34 pixels overblijft.
 * De hoverkaart toont onveranderd alles.
 *
 * Args:
 *     celGrootte: De maat van een dagvakje in pixels, vierkant. Was vast op 34; het scherm
 *         bedient dit met plus en min. Wat er bij welke maat in de fiche past bepaalt de
 *         aanroeper, want die tekent de fiche. Zie maand-celgrootte.
 */
export function PlannerMonthOverviewGrid({
  participants,
  dayparts,
  year,
  month,
  renderCell,
  holidayLabels,
  onParticipantNameClick,
  verborgenWeekdagen,
  celGrootte = MAAND_CEL_STANDAARD,
}: {
  participants: PraktijkplannerParticipant[];
  dayparts: PraktijkplannerDaypart[];
  year: number;
  month: number;
  renderCell: (cell: PlannerDaypartCell) => ReactNode;
  holidayLabels?: ReadonlyMap<string, string[]>;
  onParticipantNameClick?: (participant: PraktijkplannerParticipant) => void;
  /** ISO-weekdagen die de groep nooit gebruikt. Zie weekdagenZonderRooster. */
  verborgenWeekdagen?: ReadonlySet<number>;
  celGrootte?: number;
}) {
  const huidigMoment = useHuidigMoment();
  const bounds = monthBounds(year, month);
  if (!bounds) return null;

  // De weekkoppen tellen daarna vanzelf minder dagen, want die worden uit deze lijst afgeleid.
  const dates = datesBetweenInclusive(bounds.start, bounds.end).filter(
    (datum) => !verborgenWeekdagen?.has(weekdayFromIsoDate(datum))
  );
  const geordendeDagdelen = [...dayparts].sort((a, b) => a.volgorde - b.volgorde);
  const groepen = weekGroepen(dates);

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card shadow-sm">
      <table className="border-separate border-spacing-0 text-[10px]">
        <thead>
          <tr>
            {/*
              De namenkolom blijft staan bij het zijwaarts scrollen. Zonder dat weet je bij dag
              20 niet meer naar wiens rij je kijkt, en dat is nu juist wat dit overzicht doet.
            */}
            <th
              rowSpan={2}
              style={{ width: NAAM_BREEDTE_PX, minWidth: NAAM_BREEDTE_PX, left: 0 }}
              className="sticky z-20 border-r border-b bg-muted/40 px-2 py-1 text-left font-semibold text-muted-foreground"
            >
              Deelnemer
            </th>
            <th
              rowSpan={2}
              style={{ width: DAGDEEL_BREEDTE_PX, minWidth: DAGDEEL_BREEDTE_PX, left: NAAM_BREEDTE_PX }}
              className="sticky z-20 border-r border-b bg-muted/40 px-1 py-1 text-center font-semibold text-muted-foreground"
            >
              <span className="sr-only">Dagdeel</span>
            </th>
            {groepen.map((groep, index) => (
              <th
                key={`${groep.week}-${index}`}
                colSpan={groep.dagen}
                className="border-r border-b bg-muted/40 px-1 py-1 text-center font-semibold text-muted-foreground"
              >
                Week {groep.week}
              </th>
            ))}
          </tr>
          <tr>
            {dates.map((datum) => {
              const weekdag = weekdayFromIsoDate(datum);
              const feestdagen = holidayLabels?.get(datum) ?? [];
              return (
                <th
                  key={datum}
                  style={{ width: celGrootte, minWidth: celGrootte }}
                  className={[
                    'border-r border-b px-0 py-1 text-center font-medium',
                    weekdag >= 6 ? 'bg-muted/60' : 'bg-muted/20',
                    feestdagen.length > 0 ? 'text-rose-700' : 'text-muted-foreground',
                  ].join(' ')}
                  title={feestdagen.length > 0 ? feestdagen.join(', ') : undefined}
                >
                  <span className="block leading-tight">{WEEKDAG_LETTERS[weekdag - 1]}</span>
                  <span className="block font-semibold leading-tight text-foreground">
                    {Number(datum.slice(8, 10))}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {participants.map((participant) =>
            geordendeDagdelen.map((daypart, index) => (
              <tr key={`${participant.id}-${daypart.id}`}>
                {index === 0 ? (
                  <th
                    rowSpan={geordendeDagdelen.length}
                    style={{ width: NAAM_BREEDTE_PX, minWidth: NAAM_BREEDTE_PX, left: 0 }}
                    className="sticky z-10 border-r border-b-2 bg-card px-2 py-1 text-left align-top font-medium"
                  >
                    {onParticipantNameClick ? (
                      <button
                        type="button"
                        className="cursor-pointer text-left hover:underline"
                        onClick={() => onParticipantNameClick(participant)}
                      >
                        {deelnemerNaam(participant)}
                      </button>
                    ) : (
                      <span>{deelnemerNaam(participant)}</span>
                    )}
                  </th>
                ) : null}
                <th
                  style={{ width: DAGDEEL_BREEDTE_PX, minWidth: DAGDEEL_BREEDTE_PX, left: NAAM_BREEDTE_PX }}
                  className={[
                    'sticky z-10 border-r bg-card px-1 text-center text-[9px] font-normal text-muted-foreground',
                    index === geordendeDagdelen.length - 1 ? 'border-b-2' : 'border-b',
                  ].join(' ')}
                  title={daypart.naam}
                >
                  {daypart.naam.slice(0, 1)}
                </th>
                {dates.map((datum) => {
                  const weekdag = weekdayFromIsoDate(datum);
                  const isNu =
                    datum === huidigMoment?.datum && daypart.volgorde === huidigMoment.volgorde;
                  return (
                    <td
                      key={datum}
                      style={{ width: celGrootte, minWidth: celGrootte }}
                      className={[
                        'border-r border-b p-0 text-center align-middle',
                        weekdag >= 6 ? 'bg-muted/40' : '',
                        index === geordendeDagdelen.length - 1 ? 'border-b-2' : '',
                        isNu ? 'ring-1 ring-inset ring-emerald-600' : '',
                      ].join(' ')}
                    >
                      {/*
                        Een fiche vult zijn vakje met h-full, en dat rekent alleen als de ouder
                        een hoogte in pixels heeft. Een td met alleen een klasse geeft die niet
                        door, dus staat de hoogte hier op het blokje eromheen.
                      */}
                      <div className="relative" style={{ height: celGrootte }}>
                        {renderCell({ participant, datum, daypart })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
