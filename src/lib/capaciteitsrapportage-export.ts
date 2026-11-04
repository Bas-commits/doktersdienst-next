import { DAG_NOTATIE, downloadWerkboek, type ExcelWaarde } from '@/lib/excel-export';

export type RapportageRegel = {
  datum: string;
  iddagdeel: number;
  iddeelnemer: number;
  soort: 'activiteit' | 'specificatie' | 'taak';
  label: string;
};

export type RapportageMatrixRij = {
  soort: 'activiteit' | 'specificatie' | 'taak';
  label: string;
  cellen: Record<string, number>;
  totaal: number;
};

export type RapportageKolom = { weekdagId: string; weekdagLabel: string; dagdeelId: number; dagdeelNaam: string };

/**
 * De datums gaan als datum en niet als tekst het bestand in, maar zonder tijd: het dagdeel
 * staat in een eigen kolom en zegt al of het ochtend of avond was. Zou de tijd meegaan, dan
 * stond achter elke regel 00:00, en dat leest als een gegeven terwijl het er geen is.
 */
function toDag(isoDatum: string): Date {
  return new Date(`${isoDatum}T00:00:00`);
}

function matrixBlad(
  naam: string,
  rijen: RapportageMatrixRij[],
  kolommen: RapportageKolom[]
): { naam: string; rijen: ExcelWaarde[][]; kolombreedtes: number[] } {
  return {
    naam,
    kolombreedtes: [28, ...kolommen.map(() => 5), 10],
    rijen: [
      ['', ...kolommen.map((kolom) => kolom.weekdagLabel), ''],
      ['Wat', ...kolommen.map((kolom) => kolom.dagdeelNaam), 'Totaal'],
      ...rijen.map((rij) => [
        rij.label,
        ...kolommen.map((kolom) => rij.cellen[`${kolom.weekdagId}:${kolom.dagdeelId}`] ?? 0),
        rij.totaal,
      ]),
    ],
  };
}

/**
 * Bouwt en downloadt de capaciteitsrapportage.
 *
 * Drie bladen. Gegevens is de bron: een regel per toekenning, met de dokter erbij, zodat iemand
 * er zelf een draaitabel op kan zetten. Activiteiten en Taken zijn de twee blokken die het
 * scherm toont, opgebouwd uit diezelfde toekenningen.
 *
 * Bewust niet een blad per activiteit, zoals bij de andere schermen afgesproken: een
 * waarneemgroep heeft er al gauw twintig, en dan is de tabbalk niet meer af te lezen.
 */
export async function downloadCapaciteitsrapportage(params: {
  bestandsnaam: string;
  waarneemgroep: string;
  van: string;
  tot: string;
  regels: RapportageRegel[];
  activiteitRijen: RapportageMatrixRij[];
  taakRijen: RapportageMatrixRij[];
  kolommen: RapportageKolom[];
  deelnemerNaam: (iddeelnemer: number) => string;
  dagdeelNaam: (iddagdeel: number) => string;
}): Promise<void> {
  const kop = `${params.waarneemgroep}, ${params.van} tot en met ${params.tot}`;

  await downloadWerkboek(
    params.bestandsnaam,
    [
      {
        naam: 'Gegevens',
        kolombreedtes: [14, 14, 32, 16, 28],
        rijen: [
          [kop],
          [],
          ['Datum', 'Dagdeel', 'Dokter', 'Soort', 'Wat'],
          ...params.regels.map((regel) => [
            toDag(regel.datum),
            params.dagdeelNaam(regel.iddagdeel),
            params.deelnemerNaam(regel.iddeelnemer),
            regel.soort,
            regel.label,
          ]),
        ],
      },
      matrixBlad('Activiteiten', params.activiteitRijen, params.kolommen),
      matrixBlad('Taken', params.taakRijen, params.kolommen),
    ],
    DAG_NOTATIE
  );
}
