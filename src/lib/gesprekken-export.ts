export type GesprekExportRow = {
  deelnemerNaam: string;
  van: string;
  tot: string;
  duur: string;
  vannummer: string;
  naarnummer: string;
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

/**
 * Builds and downloads a workbook with gesprekken for the selected period.
 */
export async function downloadGesprekkenWorkbook(params: {
  filename: string;
  van: number;
  tot: number;
  rows: GesprekExportRow[];
}): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  const sheet = XLSX.utils.aoa_to_sheet([
    [formatPeriodLabel(params.van, params.tot)],
    [],
    ['Deelnemer', 'Van', 'Tot', 'Duur', 'Van nummer', 'Naar nummer'],
    ...params.rows.map((row) => [
      row.deelnemerNaam,
      row.van,
      row.tot,
      row.duur,
      row.vannummer,
      row.naarnummer,
    ]),
  ]);
  sheet['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Gesprekken');

  XLSX.writeFile(workbook, params.filename);
}
