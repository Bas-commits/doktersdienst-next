'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { BsCalculator } from 'react-icons/bs';
import { authClient } from '@/lib/auth-client';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { downloadUrentellingWorkbook } from '@/lib/urentelling-export';
import { useUrentelling } from '@/hooks/useUrentelling';
import { UrentellingTable } from '@/components/UrentellingTable';

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

function formatDateForFilename(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

const URENTELLING_ACTION_GRADIENT =
  'linear-gradient(90deg, rgb(79, 27, 153) 0%, rgb(45, 34, 69) 100%)';
const URENTELLING_ACTION_GRADIENT_HOVER =
  'linear-gradient(90deg, rgb(56, 19, 108) 0%, rgb(45, 34, 69) 100%)';

export default function UrentellingPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { activeWaarneemgroepId, waarneemgroepen } = useWaarneemgroep();

  const [queryVan, setQueryVan] = useState(defaultFrom);
  const [queryTot, setQueryTot] = useState(defaultTo);
  const [searchVan, setSearchVan] = useState(defaultFrom);
  const [searchTot, setSearchTot] = useState(defaultTo);
  const [downloading, setDownloading] = useState(false);

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

  const vanGte = useMemo(() => fromDateTimeLocal(searchVan) || null, [searchVan]);
  const totLte = useMemo(() => fromDateTimeLocal(searchTot) || null, [searchTot]);
  const rangeInvalid = vanGte != null && totLte != null && totLte < vanGte;

  const { columns, rows, details, commitmentPerRow, responseVan, responseTot, loading, error } =
    useUrentelling(
      session?.user && selectedGroupId != null && !rangeInvalid ? selectedGroupId : null,
      vanGte,
      totLte
    );

  const displayError = rangeInvalid ? 'Tot moet na Van liggen.' : error;

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
        columns,
        rows,
        details,
      });
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
            {displayError && <p className="text-sm text-destructive">{displayError}</p>}
            {!loading && !displayError && selectedGroupId != null && rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Geen echte deelnemers gevonden voor deze waarneemgroep.
              </p>
            )}

            {!loading && !displayError && rows.length > 0 && (
              <UrentellingTable
                key={`${selectedGroupId}-${responseVan}-${responseTot}`}
                rows={rows}
                columns={columns}
                details={details}
                commitmentPerRow={commitmentPerRow}
                responseVan={responseVan}
                responseTot={responseTot}
                activeGroupName={activeGroupName}
                onOpenDeelnemer={openDeelnemerGegevens}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
