'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { downloadUrentellingWorkbook } from '@/lib/urentelling-export';
import type { UrentellingDetailRow, UrentellingRow } from '@/lib/urentelling';

type UrentellingApiResponse = {
  van?: number;
  tot?: number;
  rows?: UrentellingRow[];
  details?: UrentellingDetailRow[];
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

function formatDateForFilename(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export default function UrentellingPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { activeWaarneemgroepId, waarneemgroepen } = useWaarneemgroep();

  const [queryVan, setQueryVan] = useState(defaultFrom);
  const [queryTot, setQueryTot] = useState(defaultTo);
  const [searchVan, setSearchVan] = useState(defaultFrom);
  const [searchTot, setSearchTot] = useState(defaultTo);

  const [rows, setRows] = useState<UrentellingRow[]>([]);
  const [details, setDetails] = useState<UrentellingDetailRow[]>([]);
  const [responseVan, setResponseVan] = useState<number | null>(null);
  const [responseTot, setResponseTot] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const loadUrentelling = useCallback(
    async (params: { idwaarneemgroep: number; van: string; tot: string }) => {
      const vanGte = fromDateTimeLocal(params.van);
      const totLte = fromDateTimeLocal(params.tot);
      if (!vanGte || !totLte) {
        setError('Vul een geldige datum/tijd range in.');
        setRows([]);
        return;
      }
      if (totLte < vanGte) {
        setError('Tot moet na Van liggen.');
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
        setRows(data.rows ?? []);
        setDetails(data.details ?? []);
        setResponseVan(data.van ?? vanGte);
        setResponseTot(data.tot ?? totLte);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kon urentelling niet laden');
        setRows([]);
        setDetails([]);
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

  async function handleDownloadExcel() {
    if (rows.length === 0 || responseVan == null || responseTot == null) return;
    const filename = `urentelling-${activeGroupName}-${formatDateForFilename(responseVan)}-${formatDateForFilename(responseTot)}.xlsx`;
    setDownloading(true);
    try {
      await downloadUrentellingWorkbook({
        filename,
        van: responseVan,
        tot: responseTot,
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
              <Button type="submit">Zoeken</Button>
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
              <p className="text-sm text-muted-foreground">Geen deelnemers gevonden voor deze waarneemgroep.</p>
            )}

            {!loading && !error && rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Naam</th>
                      <th className="pb-2 pr-4 font-medium text-right">Achterwacht</th>
                      <th className="pb-2 pr-4 font-medium text-right">Dienst</th>
                      <th className="pb-2 pr-4 font-medium text-right">Extra dokter</th>
                      <th className="pb-2 pr-4 font-medium text-right">Totaal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.iddeelnemer}
                        className="cursor-pointer border-b last:border-0 even:bg-muted/70 hover:bg-muted/50"
                        onClick={() => openDeelnemerGegevens(row.iddeelnemer)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDeelnemerGegevens(row.iddeelnemer);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        title="Open gegevens van deze deelnemer"
                      >
                        <td className="py-2.5 pr-4 font-medium">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-8 min-w-10 items-center justify-center rounded-md px-2 text-xs font-semibold text-white"
                              style={{ backgroundColor: row.color }}
                            >
                              {row.initials}
                            </span>
                            <span>{row.naam}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {formatDecimalHours(row.achterwacht)}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {formatDecimalHours(row.dienst)}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {formatDecimalHours(row.extraDokter)}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {formatDecimalHours(row.totaal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
