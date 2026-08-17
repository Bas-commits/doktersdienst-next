import { DAG_NOTATIE, downloadWerkboek } from '@/lib/excel-export';
import type { PraktijkplannerYearBalanceMutation } from '@/types/praktijkplanner';

export type AbsentieBalansRegel = {
  type: string;
  beginsaldo: number;
  budget: number;
  mutaties: number;
  mutatiesVoorlopig: number;
  totaal: number;
  totaalVoorlopig: number;
  datums: PraktijkplannerYearBalanceMutation[];
  datumsVoorlopig: PraktijkplannerYearBalanceMutation[];
};

/**
 * De datum gaat als datum mee maar zonder tijd: het dagdeel staat in een eigen kolom en zegt al
 * of het ochtend of middag was.
 */
function toDag(isoDatum: string): Date {
  return new Date(`${isoDatum}T00:00:00`);
}

/**
 * Bouwt en downloadt de absentietelling van een deelnemer over een jaar.
 *
 * Twee bladen. Balans is de tabel van het scherm. Gegevens is de reden dat dit bestand bestaat:
 * daar staat elke afwezige dagdeel apart, met de datum erbij. Op het scherm zitten die datums
 * verstopt achter een uitklapper per regel, en daar valt niets mee te rekenen.
 *
 * Aangevraagd en vastgelegd staan in dezelfde lijst met een kolom ernaast, niet in twee bladen.
 * Wie ze uit elkaar wil houden filtert die kolom; wie het totaal wil hoeft niets samen te
 * voegen. Andersom kan dat niet.
 */
export async function downloadAbsentietelling(params: {
  bestandsnaam: string;
  deelnemer: string;
  jaar: number;
  notitie: string;
  regels: AbsentieBalansRegel[];
}): Promise<void> {
  const kop = `${params.deelnemer}, ${params.jaar}`;

  const gegevens = params.regels.flatMap((regel) => [
    ...regel.datums.map((mutatie) => [toDag(mutatie.datum), mutatie.dagdeel, regel.type, 'vastgelegd']),
    ...regel.datumsVoorlopig.map((mutatie) => [
      toDag(mutatie.datum),
      mutatie.dagdeel,
      regel.type,
      'aangevraagd',
    ]),
  ]);
  gegevens.sort((links, rechts) => {
    const datumLinks = links[0] as Date;
    const datumRechts = rechts[0] as Date;
    return datumLinks.getTime() - datumRechts.getTime() || String(links[1]).localeCompare(String(rechts[1]), 'nl');
  });

  await downloadWerkboek(
    params.bestandsnaam,
    [
      {
        naam: 'Balans',
        kolombreedtes: [28, 12, 10, 10, 12, 12, 12],
        rijen: [
          [kop],
          [],
          [
            'Afwezigheidstype',
            'Beginsaldo',
            'Budget',
            'Vastgelegd',
            'Aangevraagd',
            'Resterend',
            'Resterend na aanvragen',
          ],
          ...params.regels.map((regel) => [
            regel.type,
            regel.beginsaldo,
            regel.budget,
            regel.mutaties,
            regel.mutatiesVoorlopig,
            regel.totaal,
            regel.totaalVoorlopig,
          ]),
          [],
          ['Notitie', params.notitie],
        ],
      },
      {
        naam: 'Gegevens',
        kolombreedtes: [14, 14, 28, 16],
        rijen: [[kop], [], ['Datum', 'Dagdeel', 'Afwezigheidstype', 'Status'], ...gegevens],
      },
    ],
    DAG_NOTATIE
  );
}
