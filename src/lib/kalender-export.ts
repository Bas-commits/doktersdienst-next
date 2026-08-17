import { downloadWerkboek, type ExcelWaarde } from '@/lib/excel-export';
import type { CalendarGridRow } from '@/components/CalandarGrid/CalendarGrid';
import type { ShiftBlockView } from '@/types/diensten';

/**
 * De gedeelde Excel-vorm voor de schermen die op de maandkalender draaien: Rooster, Overnames
 * en Vakanties.
 *
 * Een dienstblok draagt drie dokters tegelijk, en op het scherm zijn dat drie strepen boven
 * elkaar in hetzelfde vakje. In een bestand krijgt elk zijn eigen kolom in plaats van drie
 * regels per dienst: zo blijft een regel een dienst, en kan iemand filteren op "waar sta ik als
 * achterwacht" zonder eerst regels bij elkaar te moeten zoeken.
 *
 * Het alternatief, een regel per dokter per dienst, telt bij elke som de dienst driemaal. Dat is
 * precies het soort fout dat niemand opmerkt.
 */

/** Wat de drie overnamestanden betekenen, in woorden die buiten de applicatie standhouden. */
const OVERNAME_STATUS: Record<NonNullable<ShiftBlockView['overnameType']>, string> = {
  voorstelOvername: 'voorgesteld',
  vraagtekenOvername: 'afgewezen',
  overname: 'overgenomen',
};

function toMoment(unixSeconden: number): Date {
  return new Date(unixSeconden * 1000);
}

function dokterNaam(dokter: ShiftBlockView['middle']): string {
  return dokter?.name ?? '';
}

/**
 * Zet de kalenderrijen om in regels, een per dienstblok.
 *
 * @param metOvername Voegt de kolommen voor de overname toe. Alleen het Overnames-scherm heeft
 *   die; op het rooster zouden het twee lege kolommen zijn.
 */
export function kalenderRegels(
  rijen: CalendarGridRow[],
  metOvername: boolean
): { koppen: string[]; regels: ExcelWaarde[][] } {
  const koppen = [
    'Datum',
    'Van',
    'Tot',
    'Waarneemgroep',
    'Aantekening',
    'Normaal',
    'Achterwacht',
    'Extra dokter',
    ...(metOvername ? ['Overgenomen van', 'Status overname'] : []),
  ];

  const regels: ExcelWaarde[][] = [];
  for (const rij of rijen) {
    for (const blok of rij.shiftBlocks) {
      const basis: ExcelWaarde[] = [
        toMoment(blok.van),
        toMoment(blok.van),
        toMoment(blok.tot),
        rij.name ?? '',
        blok.aantekeningTekst ?? '',
        dokterNaam(blok.middle),
        dokterNaam(blok.top),
        dokterNaam(blok.bottom),
      ];
      if (metOvername) {
        basis.push(
          dokterNaam(blok.originalDoctor ?? null),
          blok.overnameType ? OVERNAME_STATUS[blok.overnameType] : ''
        );
      }
      regels.push(basis);
    }
  }

  regels.sort((links, rechts) => (links[1] as Date).getTime() - (rechts[1] as Date).getTime());
  return { koppen, regels };
}

/**
 * Bouwt en downloadt een kalenderbestand.
 *
 * Een blad. De maandkalender toont niets dat samengevat kan worden zonder een keuze te maken
 * die de ontvanger zelf beter kan maken: per dokter, per week, per dienstsoort. De regels staan
 * er, de draaitabel is aan hem.
 *
 * Datum staat als eigen kolom naast Van, hoewel het dezelfde tijd is. Wie in een draaitabel per
 * dag wil groeperen kan dat niet met een cel die ook uren en minuten bevat.
 */
export async function downloadKalender(params: {
  bestandsnaam: string;
  bladnaam: string;
  kop: string;
  rijen: CalendarGridRow[];
  metOvername?: boolean;
}): Promise<void> {
  const { koppen, regels } = kalenderRegels(params.rijen, params.metOvername === true);

  await downloadWerkboek(params.bestandsnaam, [
    {
      naam: params.bladnaam,
      kolombreedtes: [12, 18, 18, 24, 20, 24, 24, 24, 24, 18],
      dagKolommen: [0],
      rijen: [[params.kop], [], koppen, ...regels],
    },
  ]);
}
