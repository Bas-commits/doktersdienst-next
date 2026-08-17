import type {
  UrentellingColumn,
  UrentellingDetailRow,
  UrentellingRow,
} from '@/lib/urentelling';

/**
 * Notatie voor datumcellen. Excel toont dit, maar de cel bevat een echte datum, dus sorteren,
 * filteren op maand en een draaitabel werken gewoon. Eerder ging de datum als tekst het bestand
 * in: dat ziet er hetzelfde uit en kan geen van drieen.
 */
const DATE_FORMAT = 'dd-mm-yyyy hh:mm';

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
 * Geeft elke datumcel in het blad zijn notatie.
 *
 * Loopt over de cellen in plaats van over een lijst kolomnummers: welke kolom een datum is
 * verschilt per blad, en een lijst die niet meeschuift met een kolom erbij levert een bestand
 * op waarin de datums als een getal van vijf cijfers verschijnen.
 */
function applyDateFormat(sheet: Record<string, unknown>): void {
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith('!')) continue;
    const typed = cell as { t?: string; z?: string };
    if (typed.t === 'd') typed.z = DATE_FORMAT;
  }
}

/**
 * Builds and downloads a workbook with summary and underlying shift details.
 * Uses native Excel format to avoid CSV delimiter issues with Dutch decimals and names.
 */
export async function downloadUrentellingWorkbook(params: {
  filename: string;
  van: number;
  tot: number;
  columns: UrentellingColumn[];
  rows: UrentellingRow[];
  details: UrentellingDetailRow[];
}): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  const summaryHeader = ['Naam', 'FTE', ...params.columns.map((column) => column.tekst), 'Totaal'];
  const summaryRows: Array<Array<string | number>> = [];

  for (const row of params.rows) {
    summaryRows.push([row.naam, row.fte, ...row.urenPerAantekening, row.totaalDienst]);
    if (row.totaalAchterwacht > 0) {
      summaryRows.push(['als achterwacht', '', ...row.achterwachtPerAantekening, row.totaalAchterwacht]);
    }
  }

  const summarySheet = XLSX.utils.aoa_to_sheet([
    [formatPeriodLabel(params.van, params.tot)],
    [],
    summaryHeader,
    ...summaryRows,
  ]);
  summarySheet['!cols'] = [
    { wch: 36 },
    { wch: 8 },
    ...params.columns.map(() => ({ wch: 14 })),
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Urentelling');

  const detailsSheet = XLSX.utils.aoa_to_sheet(
    [
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
    { cellDates: true }
  );
  detailsSheet['!cols'] = [
    { wch: 36 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 10 },
  ];
  applyDateFormat(detailsSheet);
  XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Diensten');

  XLSX.writeFile(workbook, params.filename, { cellDates: true });
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
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  const sheet = XLSX.utils.aoa_to_sheet(
    [
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
    { cellDates: true }
  );
  sheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
  applyDateFormat(sheet);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Diensten');

  XLSX.writeFile(workbook, params.filename, { cellDates: true });
}

/** Codepunten van de combinerende accenttekens, die NFD los achter een letter zet. */
const ACCENT_START = 0x0300;
const ACCENT_EIND = 0x036f;

/**
 * Maakt van een naam een stuk bestandsnaam dat elk besturingssysteem accepteert.
 *
 * "Velde, Carine, C van der" wordt "velde-carine-c-van-der". Wat hier weg moet is meer dan de
 * verboden tekens van het bestandssysteem: een komma en een spatie leveren een bestandsnaam op
 * die in een mail of een chatvenster halverwege afbreekt.
 *
 * De accenten gaan er los af in plaats van dat de letter zelf sneuvelt. Zonder die stap wordt
 * een e met een accent geen "e" maar een streepje, en heet het bestand van Jose "jos-".
 */
export function naamVoorBestandsnaam(naam: string): string {
  const zonderAccenten = Array.from(naam.normalize('NFD'))
    .filter((teken) => {
      const code = teken.codePointAt(0) ?? 0;
      return code < ACCENT_START || code > ACCENT_EIND;
    })
    .join('');

  return (
    zonderAccenten
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'deelnemer'
  );
}
