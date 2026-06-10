import type {
  UrentellingColumn,
  UrentellingDetailRow,
  UrentellingRow,
} from '@/lib/urentelling';

function formatUnixDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPeriodLabel(van: number, tot: number): string {
  return `Periode: ${formatUnixDateTime(van)} – ${formatUnixDateTime(tot)}`;
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

  const summaryHeader = ['Naam', ...params.columns.map((column) => column.tekst), 'Totaal'];
  const summaryRows: Array<Array<string | number>> = [];

  for (const row of params.rows) {
    summaryRows.push([row.naam, ...row.urenPerAantekening, row.totaalDienst]);
    if (row.totaalAchterwacht > 0) {
      summaryRows.push(['als achterwacht', ...row.achterwachtPerAantekening, row.totaalAchterwacht]);
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
    ...params.columns.map(() => ({ wch: 14 })),
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Urentelling');

  const detailsSheet = XLSX.utils.aoa_to_sheet([
    [formatPeriodLabel(params.van, params.tot)],
    [],
    ['Arts', 'Categorie', 'Aantekening', 'Van', 'Tot', 'Uren'],
    ...params.details.map((detail) => [
      detail.naam,
      detail.categorie,
      detail.aantekening,
      formatUnixDateTime(detail.van),
      formatUnixDateTime(detail.tot),
      detail.uren,
    ]),
  ]);
  detailsSheet['!cols'] = [
    { wch: 36 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Diensten');

  XLSX.writeFile(workbook, params.filename);
}
