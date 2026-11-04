export type GesprekExportRow = {
  deelnemerNaam: string;
  van: string;
  tot: string;
  vannummer: string;
  naarnummer: string;
  duur: string;
  tarief: string;
  starttarief: string;
  kosten: string;
};

export type GesprekExportTotals = {
  duur: string;
  kosten: string;
};

function formatPeriodLabel(van: number, tot: number): string {
  const formatUnixDateTime = (unixSeconds: number) =>
    new Date(unixSeconds * 1000).toLocaleString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return `Periode: ${formatUnixDateTime(van)} – ${formatUnixDateTime(tot)}`;
}

const EXPORT_HEADERS = [
  'Deelnemer',
  'Van',
  'Tot',
  'Van nummer',
  'Naar nummer',
  'Duur',
  'Tarief',
  'Starttarief',
  'Kosten',
] as const;

/**
 * Builds and downloads a workbook with gesprekken for the selected period.
 */
export async function downloadGesprekkenWorkbook(params: {
  filename: string;
  van: number;
  tot: number;
  rows: GesprekExportRow[];
  totals: GesprekExportTotals;
}): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  const sheet = XLSX.utils.aoa_to_sheet([
    [formatPeriodLabel(params.van, params.tot)],
    [],
    [...EXPORT_HEADERS],
    ...params.rows.map((row) => [
      row.deelnemerNaam,
      row.van,
      row.tot,
      row.vannummer,
      row.naarnummer,
      row.duur,
      row.tarief,
      row.starttarief,
      row.kosten,
    ]),
    [
      'Totaal',
      '—',
      '—',
      '—',
      '—',
      params.totals.duur,
      '—',
      '—',
      params.totals.kosten,
    ],
  ]);
  sheet['!cols'] = [
    { wch: 36 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 20 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Gesprekken');

  XLSX.writeFile(workbook, params.filename);
}
