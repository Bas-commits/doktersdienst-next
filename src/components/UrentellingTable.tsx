'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { naamVoorBestandsnaam } from '@/lib/excel-export';
import { downloadDeelnemerWorkbook } from '@/lib/urentelling-export';
import type {
  UrentellingColumn,
  UrentellingCommitmentCell,
  UrentellingDetailRow,
  UrentellingRow,
} from '@/lib/urentelling';
import { getContrastTextColor } from '@/utils/contrastTextColor';

function pad(number: number): string {
  return String(number).padStart(2, '0');
}

function formatDecimalHours(value: number): string {
  return value.toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatFte(value: number): string {
  return value.toLocaleString('nl-NL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDateForFilename(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function formatUnixDateTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function detailHoursForColumn(detail: UrentellingDetailRow, columnId: number): string {
  return columnId === detail.idaantekening ? formatDecimalHours(detail.uren) : '';
}

function formatDetailLabel(detail: UrentellingDetailRow): string {
  return `${detail.categorie} · ${formatUnixDateTime(detail.van)} – ${formatUnixDateTime(detail.tot)}`;
}

/**
 * De FTE-kolom staat tussen Naam en de aantekeningkolommen, maar is een eigenschap van de
 * deelnemer en niet van een dienst, en is waar de gekleurde cirkels tegen worden afgezet. Zonder
 * scheidingslijn leest hij als nog een kolom met diensten.
 */
const FTE_COLUMN_CLASS = 'border-r border-border pr-6';

const COMMITMENT_DOT_CLASS: Record<
  Exclude<UrentellingCommitmentCell['level'], 'none'>,
  string
> = {
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

function formatCommitmentPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function formatCommitmentTooltip(cell: UrentellingCommitmentCell): string {
  if (cell.level === 'none' || cell.ratio == null || cell.expectedHours == null) {
    return '';
  }
  return `${formatCommitmentPercent(cell.ratio)} van verwachte ${formatDecimalHours(cell.expectedHours)} uur`;
}

function CommitmentDot({ cell }: { cell: UrentellingCommitmentCell | undefined }) {
  if (!cell || cell.level === 'none') return null;

  const tooltip = formatCommitmentTooltip(cell);
  return (
    <span
      className={`inline-block size-2.5 shrink-0 rounded-full ${COMMITMENT_DOT_CLASS[cell.level]}`}
      title={tooltip}
      aria-label={tooltip}
    />
  );
}

function HoursWithCommitment({
  hours,
  cell,
}: {
  hours: number;
  cell: UrentellingCommitmentCell | undefined;
}) {
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {formatDecimalHours(hours)}
      <CommitmentDot cell={cell} />
    </span>
  );
}

/**
 * De urentelling-tabel zelf: legenda, kleurcirkels en de rijen per deelnemer, met per rij een
 * uitklapbare lijst van diensten en een eigen downloadknop.
 *
 * Losgetrokken uit urentelling.tsx zodat het Urentelling-paneel naast het rooster (zie
 * UrentellingPanel.tsx) exact dezelfde tabel tekent als de eigen pagina, in plaats van een
 * tweede versie die bij de eerste wijziging uit elkaar loopt.
 *
 * Args:
 *     activeGroupName: voor de bestandsnaam van een individuele download. Losstaand van de
 *         rijen zelf, want de groepsnaam zit niet in een UrentellingRow.
 *     compact: laat de toelichtende alinea boven de legenda weg. Scheelt ruimte in een smal
 *         paneel naast een rooster, waar de legenda zelf (de kleurbetekenis) nog wel nodig is
 *         om de cirkels te kunnen lezen.
 */
export function UrentellingTable({
  rows,
  columns,
  details,
  commitmentPerRow,
  responseVan,
  responseTot,
  activeGroupName,
  onOpenDeelnemer,
  compact = false,
}: {
  rows: UrentellingRow[];
  columns: UrentellingColumn[];
  details: UrentellingDetailRow[];
  commitmentPerRow: UrentellingCommitmentCell[][];
  responseVan: number | null;
  responseTot: number | null;
  activeGroupName: string;
  onOpenDeelnemer: (deelnemerId: number) => void;
  compact?: boolean;
}) {
  const [expandedDeelnemerIds, setExpandedDeelnemerIds] = useState<Set<number>>(new Set());
  const [downloadingDeelnemerId, setDownloadingDeelnemerId] = useState<number | null>(null);

  const detailsByDeelnemer = useMemo(() => {
    const grouped = new Map<number, UrentellingDetailRow[]>();
    for (const detail of details) {
      const existing = grouped.get(detail.iddeelnemer) ?? [];
      existing.push(detail);
      grouped.set(detail.iddeelnemer, existing);
    }
    return grouped;
  }, [details]);

  function toggleDeelnemerDetails(deelnemerId: number) {
    setExpandedDeelnemerIds((current) => {
      const next = new Set(current);
      if (next.has(deelnemerId)) {
        next.delete(deelnemerId);
      } else {
        next.add(deelnemerId);
      }
      return next;
    });
  }

  async function handleDownloadDeelnemer(row: UrentellingRow) {
    if (responseVan == null || responseTot == null) return;
    const filename = `urentelling-${naamVoorBestandsnaam(row.naam)}-${formatDateForFilename(responseVan)}-${formatDateForFilename(responseTot)}.xlsx`;
    setDownloadingDeelnemerId(row.iddeelnemer);
    try {
      await downloadDeelnemerWorkbook({
        filename,
        naam: row.naam,
        van: responseVan,
        tot: responseTot,
        details: detailsByDeelnemer.get(row.iddeelnemer) ?? [],
      });
    } finally {
      setDownloadingDeelnemerId(null);
    }
  }

  return (
    <div className="space-y-3">
      {!compact ? (
        <p className="text-sm text-muted-foreground">
          Alleen echte deelnemers worden getoond. De gekleurde cirkel geeft de voortgang t.o.v.
          de FTE-verdeelde urenverplichting in de geselecteerde periode.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-green-500" aria-hidden />
          Minder dan 80%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-orange-500" aria-hidden />
          80% – 100%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-red-500" aria-hidden />
          Meer dan 100%
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Naam</th>
              <th className={`pb-2 font-medium text-right ${FTE_COLUMN_CLASS}`}>FTE</th>
              {columns.map((column) => (
                <th key={column.id} className="pb-2 pr-4 font-medium text-right">
                  {column.tekst}
                </th>
              ))}
              <th className="pb-2 pr-4 font-medium text-right">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const hasAchterwacht = row.totaalAchterwacht > 0;
              const rowDetails = detailsByDeelnemer.get(row.iddeelnemer) ?? [];
              const isExpanded = expandedDeelnemerIds.has(row.iddeelnemer);
              const rowCommitment = commitmentPerRow[rowIndex] ?? [];
              const rowGroupClass = rowIndex % 2 === 1 ? 'bg-muted/70' : undefined;

              return (
                <Fragment key={row.iddeelnemer}>
                  <tr
                    className={`border-b hover:bg-muted/50 ${rowGroupClass ?? ''} ${hasAchterwacht || isExpanded ? '' : 'last:border-0'}`}
                  >
                    <td className="py-2.5 pr-4 font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleDeelnemerDetails(row.iddeelnemer)}
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded
                              ? `Verberg diensten van ${row.naam}`
                              : `Toon diensten van ${row.naam}`
                          }
                          title={isExpanded ? 'Verberg diensten' : 'Toon diensten'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4" aria-hidden />
                          ) : (
                            <ChevronRight className="size-4" aria-hidden />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownloadDeelnemer(row)}
                          disabled={rowDetails.length === 0 || downloadingDeelnemerId === row.iddeelnemer}
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Download de diensten van ${row.naam} als Excel-bestand`}
                          title={
                            rowDetails.length === 0
                              ? 'Geen diensten in deze periode'
                              : 'Download de diensten van deze arts als Excel-bestand'
                          }
                        >
                          <Download className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDeelnemer(row.iddeelnemer)}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left hover:underline"
                          title="Open gegevens van deze deelnemer"
                        >
                          <span
                            className="inline-flex h-8 min-w-10 shrink-0 items-center justify-center rounded-md px-2 text-xs font-semibold"
                            style={{
                              backgroundColor: row.color,
                              color: getContrastTextColor(row.color),
                            }}
                          >
                            {row.initials}
                          </span>
                          <span className="truncate">{row.naam}</span>
                        </button>
                      </div>
                    </td>
                    <td className={`py-2.5 text-right tabular-nums text-muted-foreground ${FTE_COLUMN_CLASS}`}>
                      {formatFte(row.fte)}
                    </td>
                    {row.urenPerAantekening.map((uren, index) => (
                      <td
                        key={`${row.iddeelnemer}-dienst-${columns[index]?.id ?? index}`}
                        className="py-2.5 pr-4 text-right tabular-nums"
                      >
                        <HoursWithCommitment hours={uren} cell={rowCommitment[index]} />
                      </td>
                    ))}
                    <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                      <HoursWithCommitment hours={row.totaalDienst} cell={rowCommitment[columns.length]} />
                    </td>
                  </tr>
                  {hasAchterwacht && (
                    <tr
                      className={`border-b text-muted-foreground ${rowGroupClass ?? ''} ${isExpanded ? '' : 'last:border-0'}`}
                    >
                      <td className="py-1.5 pr-4 pl-12 text-sm italic">als achterwacht</td>
                      <td className={`py-1.5 ${FTE_COLUMN_CLASS}`} />
                      {row.achterwachtPerAantekening.map((uren, index) => (
                        <td
                          key={`${row.iddeelnemer}-achterwacht-${columns[index]?.id ?? index}`}
                          className="py-1.5 pr-4 text-right tabular-nums"
                        >
                          {formatDecimalHours(uren)}
                        </td>
                      ))}
                      <td className="py-1.5 pr-4 text-right tabular-nums">
                        {formatDecimalHours(row.totaalAchterwacht)}
                      </td>
                    </tr>
                  )}
                  {isExpanded && rowDetails.length === 0 && (
                    <tr className={`border-b text-xs text-muted-foreground last:border-0 ${rowGroupClass ?? ''}`}>
                      <td className="py-1.5 pr-4 pl-12">Geen diensten in deze periode.</td>
                      <td className={`py-1.5 ${FTE_COLUMN_CLASS}`} />
                      {columns.map((column) => (
                        <td key={`${row.iddeelnemer}-empty-${column.id}`} className="py-1.5 pr-4" />
                      ))}
                      <td className="py-1.5 pr-4" />
                    </tr>
                  )}
                  {isExpanded &&
                    rowDetails.map((detail, detailIndex) => (
                      <tr
                        key={`${row.iddeelnemer}-detail-${detail.van}-${detail.tot}-${detail.categorie}-${detailIndex}`}
                        className={`border-b text-xs text-muted-foreground ${rowGroupClass ?? ''} ${
                          detailIndex === rowDetails.length - 1 ? 'last:border-0' : ''
                        }`}
                      >
                        <td className="py-1.5 pr-4 pl-12 whitespace-nowrap">{formatDetailLabel(detail)}</td>
                        <td className={`py-1.5 ${FTE_COLUMN_CLASS}`} />
                        {columns.map((column) => (
                          <td
                            key={`${row.iddeelnemer}-detail-${detailIndex}-${column.id}`}
                            className="py-1.5 pr-4 text-right tabular-nums"
                          >
                            {detailHoursForColumn(detail, column.id)}
                          </td>
                        ))}
                        <td className="py-1.5 pr-4" />
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
