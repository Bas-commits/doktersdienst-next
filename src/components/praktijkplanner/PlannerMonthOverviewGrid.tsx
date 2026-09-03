'use client';

import { type ReactNode } from 'react';
import { useHuidigMoment } from '@/hooks/praktijkplanner/useHuidigMoment';
import {
  datesBetweenInclusive,
  isoWeekNumber,
  monthBounds,
  startOfIsoWeek,
  weekdayFromIsoDate,
  weekRangeLabel,
} from '@/lib/praktijkplanner/dates';
import type {
  PraktijkplannerDaypart,
  PraktijkplannerDaypartTime,
  PraktijkplannerParticipant,
} from '@/types/praktijkplanner';
import { MAAND_CEL_STANDAARD } from '@/lib/praktijkplanner/maand-celgrootte';
import { tijdLabels } from '@/lib/praktijkplanner/daypart-times';
import { DaypartIcon } from './DaypartIcon';
import type { PlannerDaypartCell } from './PlannerDaypartGrid';

const WEEKDAG_LETTERS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

const NAAM_BREEDTE_PX = 176;

/**
 * De maat van het dagdeelplaatje in een leeg vakje.
 *
 * 24 is wat de weekweergave gebruikt. Het kleinste maandvakje is 34 pixels en daar zou dat
 * tegen de randen aan lopen, dus houdt dit twaalf pixels lucht over tot het plaatje bij de
 * grotere maten op zijn gewone maat uitkomt.
 */
function icoonMaat(celGrootte: number): number {
  return Math.min(24, celGrootte - 12);
}

/**
 * Hoogte van de weeknummerrij, zodat de datumrij eronder weet waar hij moet blijven hangen.
 *
 * Een vaste maat en geen meting: de rij bevat één regel tekst van 10 pixels en verandert
 * nergens van hoogte. Zou hij dat ooit wel doen, dan schuift de datumrij zichtbaar mis en is
 * dat hier in één getal te herstellen.
 */
const WEEKKOP_HOOGTE_PX = 22;

/**
 * Dekkende variant van een doorzichtige tint, alvast gemengd met de kaartachtergrond.
 *
 * De kop blijft bij het scrollen staan en de rijen schuiven eronder door. Een half
 * doorzichtige achtergrond laat die rijen dan door de kop heen schemeren, en dan lees je de
 * datums niet meer. Dit mengt dezelfde tint met de achtergrond waar hij toch al op lag, dus
 * de kop ziet er hetzelfde uit maar laat niets meer door. Via color-mix, zodat het donkere
 * thema meeverandert.
 */
function dekkendeTint(percentage: number): string {
  return `color-mix(in oklab, var(--muted) ${percentage}%, var(--card))`;
}

/*
 * Laagvolgorde in dit rooster, van onder naar boven:
 *
 *   z-20  het "?"-vlaggetje op een fiche, gezet in PlannerCombinedDaypartChip
 *   z-30  de namenkolom, die bij zijwaarts scrollen blijft staan
 *   z-40  de kop met weeknummers en datums, die bij scrollen omlaag blijft staan
 *   z-50  de twee hoekcellen, die in beide richtingen blijven staan
 *
 * Deze vier moeten uit elkaar liggen. Stond de kop op dezelfde laag als het vlaggetje, dan won
 * het vlaggetje omdat het later in de HTML staat, en dan piepen er stukjes fiche door de kop
 * heen. Hetzelfde gold voor de namenkolom bij zijwaarts scrollen.
 */

/** Achternaam eerst, net als in de weekweergave en in de lijst deelnemers. */
function deelnemerNaam(participant: PraktijkplannerParticipant): string {
  return [participant.achternaam, participant.voornaam].filter(Boolean).join(', ');
}

/**
 * Wat er van de weekkop past bij deze breedte.
 *
 * Een maand begint en eindigt zelden op een weekgrens, dus de eerste en de laatste week staan
 * soms boven één kolom van 34 pixels. Daar past "Week 36 · 31 aug - 6 sep" niet in, en
 * afkappen liet er "We..." van over: een kop die niets meer zegt. De grenzen zijn geschat op
 * ongeveer vijf pixels per teken bij tien pixels tekst, niet gemeten. Ruim genomen, want te
 * vroeg inkorten kost alleen een datum en te laat kost het weeknummer zelf. De volledige regel
 * staat altijd in de titel van de cel.
 */
function weekkopVorm(breedtePx: number): 'volledig' | 'nummer' | 'kort' {
  if (breedtePx >= 140) return 'volledig';
  if (breedtePx >= 52) return 'nummer';
  return 'kort';
}

/**
 * De weken waar de dagen van deze maand in vallen.
 *
 * De periode is die van de hele week en niet van de kolommen eronder. Een maand begint zelden
 * op maandag, dus week 36 staat hier boven 1 tot en met 6 september terwijl hij op 31 augustus
 * begint. Zonder die datums las je alleen een weeknummer boven een halve week en klopte het
 * niet met de weekbalk bovenin, die wel de hele week noemt.
 */
function weekGroepen(dates: string[]): Array<{ week: number; periode: string; dagen: number }> {
  const groepen: Array<{ week: number; periode: string; dagen: number }> = [];
  for (const datum of dates) {
    const week = isoWeekNumber(datum);
    const laatste = groepen[groepen.length - 1];
    if (laatste && laatste.week === week) laatste.dagen += 1;
    else groepen.push({ week, periode: weekRangeLabel(startOfIsoWeek(datum)), dagen: 1 });
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
 * Welk dagdeel een rij is stond in een eigen letterkolom, O/M/A/N. Die kolom is weg: een leeg
 * vakje toont het plaatje van zijn dagdeel, net als in de week, en dat zegt hetzelfde zonder
 * breedte te kosten. Zie isCellFilled.
 *
 * In die kolom staat hetzelfde fiche als in de week, alleen kleiner getekend: de fiches zijn
 * wat een planner afleest, dus een letter in plaats daarvan haalt de maand leeg. Zie de
 * dichtheid `micro` in PlannerCombinedDaypartChip voor wat er bij 34 pixels overblijft.
 * De hoverkaart toont onveranderd alles.
 *
 * Args:
 *     celGrootte: De maat van een dagvakje in pixels, vierkant. Was vast op 34; het scherm
 *         bedient dit met plus en min. Wat er bij welke maat in het fiche past bepaalt de
 *         aanroeper, want die tekent het fiche. Zie maand-celgrootte.
 */
export function PlannerMonthOverviewGrid({
  participants,
  dayparts,
  year,
  month,
  renderCell,
  isCellFilled,
  daypartTimes,
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
  /**
   * Of er in dit vakje al iets staat. Alleen een leeg vakje krijgt het plaatje van zijn dagdeel.
   *
   * Zonder deze functie tekent dit rooster geen enkel plaatje. Dat is de veilige kant op: een
   * plaatje dat door een fiche heen schemert is zichtbaar fout, een plaatje dat ontbreekt is
   * alleen minder behulpzaam.
   */
  isCellFilled?: (cell: PlannerDaypartCell) => boolean;
  /**
   * De tijden per dagdeel uit Plannerbeheer, als ballonnetje bij het vakje.
   *
   * Dit scherm heeft geen plek om ze te laten staan: een rij is hier vier en dertig pixels hoog
   * en er staan een en dertig dagen naast elkaar.
   */
  daypartTimes?: PraktijkplannerDaypartTime[];
  holidayLabels?: ReadonlyMap<string, string[]>;
  onParticipantNameClick?: (participant: PraktijkplannerParticipant) => void;
  /** ISO-weekdagen die de groep nooit gebruikt. Zie weekdagenZonderRooster. */
  verborgenWeekdagen?: ReadonlySet<number>;
  celGrootte?: number;
}) {
  /*
    De tijden een keer opzoeken en niet per vakje: een rooster tekent er honderden.
  */
  const dagdeelTijden = tijdLabels(daypartTimes ?? []);
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

              De kop blijft om dezelfde reden staan bij het scrollen naar beneden: anders zie je
              vanaf de vierde deelnemer alleen nog gekleurde blokjes zonder te weten welke dag
              welke is. Deze twee cellen staan in beide richtingen vast, want ze zitten in de
              hoek waar de twee elkaar kruisen.
            */}
            <th
              rowSpan={2}
              style={{
                width: NAAM_BREEDTE_PX,
                minWidth: NAAM_BREEDTE_PX,
                left: 0,
                top: 0,
                backgroundColor: dekkendeTint(40),
              }}
              className="sticky z-50 border-r border-b px-2 py-1 text-left font-semibold text-muted-foreground"
            >
              Deelnemer
            </th>
            {groepen.map((groep, index) => (
              <th
                key={`${groep.week}-${index}`}
                colSpan={groep.dagen}
                style={{ top: 0, height: WEEKKOP_HOOGTE_PX, backgroundColor: dekkendeTint(40) }}
                className="sticky z-40 border-r border-b p-0 text-center font-semibold text-muted-foreground"
                title={`Week ${groep.week}, ${groep.periode}`}
              >
                {/*
                  De tekst hangt los in de cel en telt dus niet mee voor de kolombreedte. Een
                  week die met één dag in de maand valt is 34 pixels breed; zou de tekst wel
                  meetellen, dan trok die ene week de kolommen eronder uit elkaar en liep de
                  maand niet meer gelijk met de dagen. Past het niet, dan valt het einde weg en
                  blijft het weeknummer staan; de hele regel staat in de titel.
                */}
                <span className="absolute inset-0 flex items-center justify-center overflow-hidden px-1">
                  {weekkopVorm(groep.dagen * celGrootte) === 'volledig' ? (
                    <span className="min-w-0 truncate">
                      Week {groep.week} <span className="font-normal">· {groep.periode}</span>
                    </span>
                  ) : (
                    <span className="min-w-0 truncate">
                      {weekkopVorm(groep.dagen * celGrootte) === 'kort'
                        ? `W${groep.week}`
                        : `Week ${groep.week}`}
                    </span>
                  )}
                </span>
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
                  style={{
                    width: celGrootte,
                    minWidth: celGrootte,
                    top: WEEKKOP_HOOGTE_PX,
                    backgroundColor: dekkendeTint(weekdag >= 6 ? 60 : 20),
                  }}
                  className={[
                    'sticky z-40 border-r border-b px-0 py-1 text-center font-medium',
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
                    className="sticky z-30 border-r border-b-2 bg-card px-2 py-1 text-left align-top font-medium"
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
                {dates.map((datum, dagIndex) => {
                  const weekdag = weekdayFromIsoDate(datum);
                  const dagdeelTijd = dagdeelTijden.get(daypart.id);
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
                      <div
                        className="relative"
                        style={{ height: celGrootte }}
                        title={dagdeelTijd ? `${daypart.naam} ${dagdeelTijd}` : undefined}
                      >
                        {/*
                          De naam van het dagdeel voor een schermlezer, eenmaal per rij.

                          Niet als eigen <th>: die telde als kolom, en omdat de kop er geen heeft
                          schoof daarmee elke rij een dag op. De fiches van dinsdag stonden dan
                          onder woensdag, zonder dat er iets misstond in de opmaak. Vandaar hier,
                          binnen het eerste vakje van de rij.
                        */}
                        {dagIndex === 0 ? (
                          <span className="sr-only">
                            {dagdeelTijd ? `${daypart.naam} ${dagdeelTijd}` : daypart.naam}
                          </span>
                        ) : null}
                        {isCellFilled?.({ participant, datum, daypart }) === false ? (
                          <DaypartIcon
                            volgorde={daypart.volgorde}
                            maatPx={icoonMaat(celGrootte)}
                            title={daypart.naam}
                            className="pointer-events-none absolute inset-0 m-auto opacity-60"
                          />
                        ) : null}
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
