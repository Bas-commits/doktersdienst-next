import { DAG_NOTATIE, downloadWerkboek, type ExcelWaarde } from '@/lib/excel-export';
import type { CapacityOverviewCell } from '@/components/praktijkplanner/CapacityOverview';

/** De vier soorten eisen, in de volgorde waarin het scherm ze onder elkaar zet. */
const SOORTEN = [
  { sleutel: 'expertises', label: 'Expertise' },
  { sleutel: 'taken', label: 'Taak' },
  { sleutel: 'activiteiten', label: 'Activiteit' },
  { sleutel: 'specificaties', label: 'Specificatie' },
] as const;

function toDag(isoDatum: string): Date {
  return new Date(`${isoDatum}T00:00:00`);
}

/**
 * Bouwt en downloadt het capaciteitsoverzicht van een week op een locatie.
 *
 * Twee bladen. Gegevens is elke eis apart, met wat er gepland staat en wat er nodig is.
 * Tekorten laat daarvan alleen de regels zien waar de bezetting onder de eis blijft.
 *
 * Dat tweede blad is de reden dat iemand dit bestand opent. Op het scherm zie je een tekort aan
 * een kleur, en dan moet je zeven dagen maal vier dagdelen langs om te vinden waar het zit. Hier
 * staat het als lijst, en die lijst is leeg als de week rond is.
 *
 * Het verschil staat als eigen kolom in het bestand en niet als formule. Een formule die bij het
 * openen herrekent kan een ander getal tonen dan waar de export op gebaseerd was, en dan is niet
 * meer na te gaan wat er in de planner stond.
 */
export async function downloadCapaciteitsoverzicht(params: {
  bestandsnaam: string;
  locatie: string;
  weekStart: string;
  weekEnd: string;
  regime: string | null;
  cellen: CapacityOverviewCell[];
}): Promise<void> {
  const kop = `${params.locatie}, week van ${params.weekStart} tot en met ${params.weekEnd}${
    params.regime ? ` (${params.regime})` : ''
  }`;

  const regels: ExcelWaarde[][] = [];
  for (const cel of params.cellen) {
    regels.push([
      toDag(cel.datum),
      cel.dagdeel,
      'Aantal deelnemers',
      cel.totaal.label,
      cel.totaal.gepland,
      cel.totaal.benodigd,
      cel.totaal.gepland - cel.totaal.benodigd,
    ]);
    for (const soort of SOORTEN) {
      for (const eis of cel[soort.sleutel]) {
        regels.push([
          toDag(cel.datum),
          cel.dagdeel,
          soort.label,
          eis.label,
          eis.gepland,
          eis.benodigd,
          eis.gepland - eis.benodigd,
        ]);
      }
    }
  }

  const tekorten = regels.filter((regel) => Number(regel[6]) < 0);

  await downloadWerkboek(
    params.bestandsnaam,
    [
      {
        naam: 'Gegevens',
        kolombreedtes: [14, 12, 16, 28, 10, 10, 10],
        rijen: [
          [kop],
          [],
          ['Datum', 'Dagdeel', 'Soort', 'Wat', 'Gepland', 'Benodigd', 'Verschil'],
          ...regels,
        ],
      },
      {
        naam: 'Tekorten',
        kolombreedtes: [14, 12, 16, 28, 10, 10, 10],
        rijen: [
          [kop],
          [],
          ['Datum', 'Dagdeel', 'Soort', 'Wat', 'Gepland', 'Benodigd', 'Verschil'],
          ...(tekorten.length > 0 ? tekorten : [['Geen tekorten in deze week.']]),
        ],
      },
    ],
    DAG_NOTATIE
  );
}
