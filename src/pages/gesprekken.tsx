'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { downloadGesprekkenWorkbook } from '@/lib/gesprekken-export';

type GesprekItem = {
  id: number | null;
  iddeelnemer: number | null;
  van: number;
  tot: number;
  vannummer: string | null;
  naarnummer: string | null;
  talkDurationSec: number;
  deelnemer: {
    id: number;
    naam: string;
    initials: string;
    color: string;
    voornaam: string | null;
    achternaam: string | null;
    voorletterstussenvoegsel: string | null;
  } | null;
};

type GesprekkenApiResponse = {
  gesprekken?: GesprekItem[];
  error?: string;
};

function pad(number: number): string {
  return String(number).padStart(2, '0');
}

function formatUnixDateTime(unixSeconds: number): string {
  if (!unixSeconds) return '—';
  return new Date(unixSeconds * 1000).toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const from = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate(), 0, 0, 0);
  return toDateTimeLocal(Math.floor(from.getTime() / 1000));
}

function defaultTo(): string {
  return toDateTimeLocal(Math.floor(Date.now() / 1000));
}

function formatDateForFilename(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function formatDeelnemerLabel(gesprek: GesprekItem): string {
  if (!gesprek.deelnemer) return '—';
  return gesprek.deelnemer.naam || `#${gesprek.deelnemer.id}`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const safe = Math.floor(seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${minutes}:${pad(secs)}`;
}

export default function GesprekkenPage() {
  const { data: session, isPending } = authClient.useSession();
  const { activeWaarneemgroepId, waarneemgroepen } = useWaarneemgroep();

  const [queryDeelnemer, setQueryDeelnemer] = useState('');
  const [queryVan, setQueryVan] = useState(defaultFrom);
  const [queryTot, setQueryTot] = useState(defaultTo);

  const [searchDeelnemer, setSearchDeelnemer] = useState('');
  const [searchVan, setSearchVan] = useState(defaultFrom);
  const [searchTot, setSearchTot] = useState(defaultTo);

  const [gesprekken, setGesprekken] = useState<GesprekItem[]>([]);
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

  const loadGesprekken = useCallback(
    async (params: { idwaarneemgroep: number; van: string; tot: string; deelnemerQ: string }) => {
      const vanGte = fromDateTimeLocal(params.van);
      const vanLte = fromDateTimeLocal(params.tot);
      if (!vanGte || !vanLte) {
        setError('Vul een geldige datum/tijd range in.');
        setGesprekken([]);
        return;
      }
      if (vanLte < vanGte) {
        setError('Tot moet na Van liggen.');
        setGesprekken([]);
        return;
      }

      const searchParams = new URLSearchParams({
        idwaarneemgroep: String(params.idwaarneemgroep),
        vanGte: String(vanGte),
        vanLte: String(vanLte),
      });
      if (params.deelnemerQ.trim()) {
        searchParams.set('deelnemerQ', params.deelnemerQ.trim());
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/gesprekken?${searchParams.toString()}`, {
          credentials: 'include',
        });
        const data = (await response.json()) as GesprekkenApiResponse;
        if (!response.ok || data.error) {
          throw new Error(data.error ?? 'Kon gesprekken niet laden');
        }
        setGesprekken(data.gesprekken ?? []);
        setResponseVan(vanGte);
        setResponseTot(vanLte);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kon gesprekken niet laden');
        setGesprekken([]);
        setResponseVan(null);
        setResponseTot(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!session?.user || selectedGroupId == null) return;
    void loadGesprekken({
      idwaarneemgroep: selectedGroupId,
      van: searchVan,
      tot: searchTot,
      deelnemerQ: searchDeelnemer,
    });
  }, [loadGesprekken, searchDeelnemer, searchTot, searchVan, selectedGroupId, session?.user]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSearchDeelnemer(queryDeelnemer);
    setSearchVan(queryVan);
    setSearchTot(queryTot);
  }

  async function handleDownloadExcel() {
    if (gesprekken.length === 0 || responseVan == null || responseTot == null) return;
    const filename = `gesprekken-${activeGroupName}-${formatDateForFilename(responseVan)}-${formatDateForFilename(responseTot)}.xlsx`;
    setDownloading(true);
    try {
      await downloadGesprekkenWorkbook({
        filename,
        van: responseVan,
        tot: responseTot,
        rows: gesprekken.map((gesprek) => ({
          deelnemerNaam: formatDeelnemerLabel(gesprek),
          van: formatUnixDateTime(gesprek.van),
          tot: formatUnixDateTime(gesprek.tot),
          duur: formatDuration(gesprek.talkDurationSec),
          vannummer: gesprek.vannummer || '—',
          naarnummer: gesprek.naarnummer || '—',
        })),
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
        <title>Gesprekken</title>
      </Head>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl font-semibold tracking-tight">Gesprekken</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={handleSubmit}
              className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto_auto]"
            >
              <Input
                type="search"
                value={queryDeelnemer}
                onChange={(event) => setQueryDeelnemer(event.target.value)}
                placeholder="Zoek deelnemer..."
                aria-label="Zoek op deelnemer"
              />
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
                disabled={loading || downloading || gesprekken.length === 0}
              >
                {downloading ? 'Downloaden…' : 'Download Excel'}
              </Button>
            </form>

            {selectedGroupId == null && (
              <p className="text-sm text-muted-foreground">Selecteer eerst een waarneemgroep.</p>
            )}
            {loading && <p className="text-sm text-muted-foreground">Gesprekken laden…</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!loading && !error && selectedGroupId != null && gesprekken.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Geen gesprekken met gespreksduur gevonden voor deze filters.
              </p>
            )}

            {!loading && !error && gesprekken.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Deelnemer</th>
                      <th className="pb-2 pr-4 font-medium">Van</th>
                      <th className="pb-2 pr-4 font-medium">Tot</th>
                      <th className="pb-2 pr-4 font-medium">Duur</th>
                      <th className="pb-2 pr-4 font-medium">Van nummer</th>
                      <th className="pb-2 pr-4 font-medium">Naar nummer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gesprekken.map((gesprek) => (
                      <tr
                        key={gesprek.id ?? `${gesprek.van}-${gesprek.vannummer}-${gesprek.naarnummer}`}
                        className="border-b last:border-0 even:bg-muted/70"
                      >
                        <td className="py-2.5 pr-4 font-medium">
                          {gesprek.deelnemer ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex h-8 min-w-10 items-center justify-center rounded-md px-2 text-xs font-semibold text-white"
                                style={{ backgroundColor: gesprek.deelnemer.color }}
                              >
                                {gesprek.deelnemer.initials}
                              </span>
                              <span>{formatDeelnemerLabel(gesprek)}</span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 pr-4">{formatUnixDateTime(gesprek.van)}</td>
                        <td className="py-2.5 pr-4">{formatUnixDateTime(gesprek.tot)}</td>
                        <td className="py-2.5 pr-4">{formatDuration(gesprek.talkDurationSec)}</td>
                        <td className="py-2.5 pr-4">{gesprek.vannummer || '—'}</td>
                        <td className="py-2.5 pr-4">{gesprek.naarnummer || '—'}</td>
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
