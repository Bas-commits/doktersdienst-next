import { downloadWerkboek, type ExcelWaarde } from '@/lib/excel-export';
import type {
  UrentellingColumn,
  UrentellingDetailRow,
  UrentellingRow,
} from '@/lib/urentelling';

function toDate(unixSeconds: number): Date {
  return new Date(unixSeconds * 1000);
}

function formatUnixDateTime(unixSeconds: number): string {
  return toDate(unixSeconds).toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPeriodLabel(van: number, tot: number): string {
  return `Periode: ${formatUnixDateTime(van)} tot ${formatUnixDateTime(tot)}`;
}

/**
 * Bouwt en downloadt het bestand van de hele waarneemgroep: de telling zoals het scherm hem
 * toont, plus de dienstregels waar die telling uit komt.
 */
export async function downloadUrentellingWorkbook(params: {
  filename: string;
  van: number;
  tot: number;
  columns: UrentellingColumn[];
  rows: UrentellingRow[];
  details: UrentellingDetailRow[];
}): Promise<void> {
  const summaryHeader = ['Naam', 'FTE', ...params.columns.map((column) => column.tekst), 'Totaal'];
  const summaryRows: ExcelWaarde[][] = [];

  for (const row of params.rows) {
    summaryRows.push([row.naam, row.fte, ...row.urenPerAantekening, row.totaalDienst]);
    if (row.totaalAchterwacht > 0) {
      summaryRows.push(['als achterwacht', '', ...row.achterwachtPerAantekening, row.totaalAchterwacht]);
    }
  }

  await downloadWerkboek(params.filename, [
    {
      naam: 'Urentelling',
      kolombreedtes: [36, 8, ...params.columns.map(() => 14), 12],
      rijen: [
        [formatPeriodLabel(params.van, params.tot)],
        [],
        summaryHeader,
        ...summaryRows,
      ],
    },
    {
      naam: 'Diensten',
      kolombreedtes: [36, 28, 18, 18, 18, 10],
      rijen: [
        [formatPeriodLabel(params.van, params.tot)],
        [],
        ['Arts', 'Categorie', 'Aantekening', 'Van', 'Tot', 'Uren'],
        ...params.details.map((detail) => [
          detail.naam,
          detail.categorie,
          detail.aantekening,
          toDate(detail.van),
          toDate(detail.tot),
          detail.uren,
        ]),
      ],
    },
  ]);
}

/**
 * Bouwt en downloadt het bestand van een enkele arts: zijn eigen dienstregels, verder niets.
 *
 * Bewust een blad zonder samenvatting per categorie erbij. Bij een arts over een periode zijn
 * dit een handvol regels, en een samenvattend blad met drie regels erin leest slechter dan de
 * regels zelf. Wie wil optellen heeft het bestand van de hele groep.
 *
 * De naam van de arts staat erboven en niet in een kolom, want elke regel is van dezelfde arts.
 */
export async function downloadDeelnemerWorkbook(params: {
  filename: string;
  naam: string;
  van: number;
  tot: number;
  details: UrentellingDetailRow[];
}): Promise<void> {
  await downloadWerkboek(params.filename, [
    {
      naam: 'Diensten',
      kolombreedtes: [28, 18, 18, 18, 10],
      rijen: [
        [params.naam],
        [formatPeriodLabel(params.van, params.tot)],
        [],
        ['Categorie', 'Aantekening', 'Van', 'Tot', 'Uren'],
        ...params.details.map((detail) => [
          detail.categorie,
          detail.aantekening,
          toDate(detail.van),
          toDate(detail.tot),
          detail.uren,
        ]),
      ],
    },
  ]);
}
