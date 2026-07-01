'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { BsCalculator } from 'react-icons/bs';
import { authClient } from '@/lib/auth-client';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { downloadUrentellingWorkbook } from '@/lib/urentelling-export';
import type {
  UrentellingColumn,
  UrentellingCommitmentCell,
  UrentellingDetailRow,
  UrentellingRow,
} from '@/lib/urentelling';
import { getContrastTextColor } from '@/utils/contrastTextColor';

type UrentellingApiResponse = {
  van?: number;
  tot?: number;
  columns?: UrentellingColumn[];
  rows?: UrentellingRow[];
  details?: UrentellingDetailRow[];
  commitment?: {
    totalFte: number;
    perRow: UrentellingCommitmentCell[][];
  };
  error?: string;
};

function pad(number: number): string {
  return String(number).padStart(2, '0');
}

function toDateTimeLocal(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocal(value: string): number {
  if (!value) return 0;
  return Math.floor(new Date(value).getTime() / 1000);
}

function defaultFrom(): string {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
  return toDateTimeLocal(Math.floor(from.getTime() / 1000));
}

function defaultTo(): string {
  return toDateTimeLocal(Math.floor(Date.now() / 1000));
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

const URENTELLING_ACTION_GRADIENT =
  'linear-gradient(90deg, rgb(79, 27, 153) 0%, rgb(45, 34, 69) 100%)';
const URENTELLING_ACTION_GRADIENT_HOVER =
  'linear-gradient(90deg, rgb(56, 19, 108) 0%, rgb(45, 34, 69) 100%)';

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

export default function UrentellingPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { activeWaarneemgroepId, waarneemgroepen } = useWaarneemgroep();

  const [queryVan, setQueryVan] = useState(defaultFrom);
  const [queryTot, setQueryTot] = useState(defaultTo);
  const [searchVan, setSearchVan] = useState(defaultFrom);
  const [searchTot, setSearchTot] = useState(defaultTo);

  const [columns, setColumns] = useState<UrentellingColumn[]>([]);
  const [rows, setRows] = useState<UrentellingRow[]>([]);
  const [details, setDetails] = useState<UrentellingDetailRow[]>([]);
  const [commitmentPerRow, setCommitmentPerRow] = useState<UrentellingCommitmentCell[][]>([]);
  const [responseVan, setResponseVan] = useState<number | null>(null);
  const [responseTot, setResponseTot] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDeelnemerIds, setExpandedDeelnemerIds] = useState<Set<number>>(new Set());

  const selectedGroupId = useMemo(() => {
    if (!activeWaarneemgroepId) return null;
    const parsed = Number(activeWaarneemgroepId);
    return Number.isNaN(parsed) ? null : parsed;
  }, [activeWaarneemgroepId]);

  const activeGroupName = useMemo(() => {
    if (selectedGroupId == null) return 'waarneemgroep';
    const wg = (waarneemgroepen ?? []).find((g) => g.ID === selectedGroupId);
    return (wg?.naam ?? 'waarneemgroep').replace(/[^\w\-]+/g, '-');
  }, [selectedGroupId, waarneemgroepen]);

  const detailsByDeelnemer = useMemo(() => {
    const grouped = new Map<number, UrentellingDetailRow[]>();
    for (const detail of details) {
      const existing = grouped.get(detail.iddeelnemer) ?? [];
      existing.push(detail);
      grouped.set(detail.iddeelnemer, existing);
    }
    return grouped;
  }, [details]);

  const loadUrentelling = useCallback(
    async (params: { idwaarneemgroep: number; van: string; tot: string }) => {
      const vanGte = fromDateTimeLocal(params.van);
      const totLte = fromDateTimeLocal(params.tot);
      if (!vanGte || !totLte) {
        setError('Vul een geldige datum/tijd range in.');
        setColumns([]);
        setRows([]);
        return;
      }
      if (totLte < vanGte) {
        setError('Tot moet na Van liggen.');
        setColumns([]);
        setRows([]);
        return;
      }

      const searchParams = new URLSearchParams({
        idwaarneemgroep: String(params.idwaarneemgroep),
        vanGte: String(vanGte),
        totLte: String(totLte),
      });

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/urentelling?${searchParams.toString()}`, {
          credentials: 'include',
        });
        const data = (await response.json()) as UrentellingApiResponse;
        if (!response.ok || data.error) {
          throw new Error(data.error ?? 'Kon urentelling niet laden');
        }
        setColumns(data.columns ?? []);
        setRows(data.rows ?? []);
        setDetails(data.details ?? []);
        setCommitmentPerRow(data.commitment?.perRow ?? []);
        setExpandedDeelnemerIds(new Set());
        setResponseVan(data.van ?? vanGte);
        setResponseTot(data.tot ?? totLte);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kon urentelling niet laden');
        setColumns([]);
        setRows([]);
        setDetails([]);
        setCommitmentPerRow([]);
        setResponseVan(null);
        setResponseTot(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!session?.user || selectedGroupId == null) return;
    void loadUrentelling({
      idwaarneemgroep: selectedGroupId,
      van: searchVan,
      tot: searchTot,
    });
  }, [loadUrentelling, searchTot, searchVan, selectedGroupId, session?.user]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSearchVan(queryVan);
    setSearchTot(queryTot);
  }

  function openDeelnemerGegevens(deelnemerId: number) {
    void router.push(`/mijn-gegevens?deelnemerId=${deelnemerId}`);
  }

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

  async function handleDownloadExcel() {
    if (rows.length === 0 || responseVan == null || responseTot == null) return;
    const filename = `urentelling-${activeGroupName}-${formatDateForFilename(responseVan)}-${formatDateForFilename(responseTot)}.xlsx`;
    setDownloading(true);
    try {
      await downloadUrentellingWorkbook({
        filename,
        van: responseVan,
        tot: responseTot,
        columns,
        rows,
        details,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kon Excel-bestand niet downloaden');
    } finally {
      setDownloading(false);
    }
  }

  if (isPending) {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">Laden…</div>;
  }

  if (!session?.user) {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">Niet ingelogd.</div>;
  }

  return (
    <>
      <Head>
        <title>Urentelling</title>
      </Head>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl font-semibold tracking-tight">Urentelling</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={handleSubmit}
              className="grid gap-3 md:grid-cols-[220px_220px_auto_auto]"
            >
              <Input
                type="datetime-local"
                value={queryVan}
                onChange={(event) => setQueryVan(event.target.value)}
                aria-label="Van datum en tijd"
              />
              <Input
                type="datetime-local"
                value={queryTot}
                onChange={(event) => setQueryTot(event.target.value)}
                aria-label="Tot datum en tijd"
              />
              <button
                type="submit"
                disabled={loading}
                className="max-w-20 inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: URENTELLING_ACTION_GRADIENT,
                  transition: 'background 0.2s',
                }}
                title="Hercalculatie"
                aria-label="Hercalculatie"
                onMouseOver={(event) => {
                  if (loading) return;
                  (event.currentTarget as HTMLButtonElement).style.background =
                    URENTELLING_ACTION_GRADIENT_HOVER;
                }}
                onMouseOut={(event) => {
                  (event.currentTarget as HTMLButtonElement).style.background =
                    URENTELLING_ACTION_GRADIENT;
                }}
              >
                {/* <FaSync
                  className={`size-4 ${loading ? 'animate-spin' : ''}`}
                  aria-hidden
                /> */}
                <BsCalculator className="size-5" aria-hidden />
              </button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleDownloadExcel()}
                disabled={loading || downloading || rows.length === 0}
              >
                {downloading ? 'Downloaden…' : 'Download Excel'}
              </Button>
            </form>

            {selectedGroupId == null && (
              <p className="text-sm text-muted-foreground">Selecteer eerst een waarneemgroep.</p>
            )}
            {loading && <p className="text-sm text-muted-foreground">Urentelling laden…</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!loading && !error && selectedGroupId != null && rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Geen echte deelnemers gevonden voor deze waarneemgroep.
              </p>
            )}

            {!loading && !error && rows.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Alleen echte deelnemers worden getoond. De gekleurde cirkel geeft de voortgang
                  t.o.v. de FTE-verdeelde urenverplichting in de geselecteerde periode.
                </p>
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
                      <th className="pb-2 pr-4 font-medium text-right">FTE</th>
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
                      const rowGroupClass =
                        rowIndex % 2 === 1 ? 'bg-muted/70' : undefined;

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
                                  onClick={() => openDeelnemerGegevens(row.iddeelnemer)}
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
                            <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                              {formatFte(row.fte)}
                            </td>
                            {row.urenPerAantekening.map((uren, index) => (
                              <td
                                key={`${row.iddeelnemer}-dienst-${columns[index]?.id ?? index}`}
                                className="py-2.5 pr-4 text-right tabular-nums"
                              >
                                <HoursWithCommitment
                                  hours={uren}
                                  cell={rowCommitment[index]}
                                />
                              </td>
                            ))}
                            <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                              <HoursWithCommitment
                                hours={row.totaalDienst}
                                cell={rowCommitment[columns.length]}
                              />
                            </td>
                          </tr>
                          {hasAchterwacht && (
                            <tr
                              className={`border-b text-muted-foreground ${rowGroupClass ?? ''} ${isExpanded ? '' : 'last:border-0'}`}
                            >
                              <td className="py-1.5 pr-4 pl-12 text-sm italic">als achterwacht</td>
                              <td className="py-1.5 pr-4" />
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
                              <td className="py-1.5 pr-4" />
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
                                <td className="py-1.5 pr-4 pl-12 whitespace-nowrap">
                                  {formatDetailLabel(detail)}
                                </td>
                                <td className="py-1.5 pr-4" />
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
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
