'use client';

import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShiftBlock } from '@/components/ShiftBlock/ShiftBlock';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { dienstenToShiftBlocks } from '@/hooks/useDienstenSchedule';
import { useDienstenSubscription } from '@/hooks/useDienstenSubscription';
import {
  nuPositiePercentage,
  roosterActueelRijen,
  roosterActueelVenster,
  type RoosterActueelGroep,
} from '@/lib/rooster-actueel';

/** Normal, achterwacht, extra dokter and open slots; no preferences. Same set as /rooster-inzien. */
const ASSIGNMENT_TYPES = [0, 1, 4, 5, 6, 11];
const UREN_LABELS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

function vandaag(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function plusDagen(dag: Date, n: number): Date {
  return new Date(dag.getFullYear(), dag.getMonth(), dag.getDate() + n);
}

function zelfdeDag(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * The 00:00–24:00 axis. Above the rows it carries the labels; inside a row only a faint line
 * every three hours, because open slots are transparent and hourly lines showed through them.
 */
function Uurlijnen({ labels }: { labels: boolean }) {
  return (
    <>
      {UREN_LABELS.map((uur) => (
        <div
          key={uur}
          aria-hidden
          className={`absolute top-0 bottom-0 border-l ${labels ? 'border-gray-300' : 'border-gray-100'}`}
          style={{ left: `${(uur / 24) * 100}%` }}
        />
      ))}
      {labels &&
        UREN_LABELS.map((uur) => (
          <span
            key={`label-${uur}`}
            className="absolute top-0 text-xs text-muted-foreground"
            // The first and last label would otherwise hang half outside the axis.
            style={{
              left: `${(uur / 24) * 100}%`,
              transform: uur === 0 ? 'none' : uur === 24 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {String(uur).padStart(2, '0')}:00
          </span>
        ))}
    </>
  );
}

function NuLijn({ percentage }: { percentage: number }) {
  return (
    <div
      aria-hidden
      data-testid="rooster-actueel-nu"
      className="pointer-events-none absolute top-0 bottom-0 z-40 w-0.5 bg-red-500"
      style={{ left: `${percentage}%` }}
    />
  );
}

export default function RoosterActueelPage() {
  const { waarneemgroepen, loading: groepenLoading, error: groepenError } = useWaarneemgroep();
  const [dag, setDag] = useState(vandaag);
  const [nu, setNu] = useState(() => new Date());

  // The red "now" line is the point of this screen; keep it moving without a reload.
  useEffect(() => {
    const timer = setInterval(() => setNu(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const groepen = useMemo<RoosterActueelGroep[]>(
    () =>
      (waarneemgroepen ?? [])
        .filter((w) => w.ID > 0)
        .map((w) => ({
          id: w.ID,
          naam: w.naam || `Waarneemgroep ${w.ID}`,
          telnronzecentrale: w.telnronzecentrale ?? null,
        }))
        .sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { numeric: true })),
    [waarneemgroepen]
  );
  const groepIds = useMemo(() => groepen.map((g) => g.id), [groepen]);

  const { vanGte, totLte } = useMemo(() => roosterActueelVenster(dag), [dag]);
  const { data, loading: dienstenLoading, error: dienstenError } = useDienstenSubscription(
    vanGte,
    totLte,
    groepIds,
    ASSIGNMENT_TYPES
  );

  const { rijen, zonderDiensten } = useMemo(
    () => roosterActueelRijen(dienstenToShiftBlocks(data ?? null), groepen, dag),
    [data, groepen, dag]
  );

  const nuPercentage = nuPositiePercentage(dag, nu);
  const isVandaag = zelfdeDag(dag, nu);
  const loading = groepenLoading || (groepIds.length > 0 && dienstenLoading && !data);
  const error = groepenError ?? dienstenError;

  return (
    <>
      <Head>
        <title>Rooster Actueel | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-[2000px] space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Rooster Actueel</h1>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDag((d) => plusDagen(d, -1))}
                  className="rounded border p-1.5 hover:bg-muted"
                  aria-label="Vorige dag"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="min-w-[14rem] text-center text-base font-medium" data-testid="rooster-actueel-datum">
                  {dag.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => setDag((d) => plusDagen(d, 1))}
                  className="rounded border p-1.5 hover:bg-muted"
                  aria-label="Volgende dag"
                >
                  <ChevronRight className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDag(vandaag())}
                  disabled={isVandaag}
                  className="rounded border px-3 py-1 text-sm font-normal hover:bg-muted disabled:cursor-default disabled:opacity-40"
                >
                  Vandaag
                </button>
              </div>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Wie er op deze dag dienst heeft in je waarneemgroepen. Houd de muis op een dienst voor de details.
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 text-destructive" role="alert">
                {error}
              </p>
            )}
            {loading && <p className="mb-4 text-muted-foreground">Rooster laden…</p>}
            {!loading && !error && groepen.length === 0 && (
              <p className="text-muted-foreground">Je bent geen lid van een waarneemgroep.</p>
            )}
            {!loading && groepen.length > 0 && rijen.length === 0 && (
              <p className="text-muted-foreground">Geen diensten op deze dag.</p>
            )}

            {rijen.length > 0 && (
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="flex">
                    <div className="w-60 shrink-0" />
                    <div className="relative h-6 flex-1">
                      <Uurlijnen labels />
                      {nuPercentage != null && (
                        <span
                          className="absolute -top-0.5 z-40 -translate-x-1/2 rounded bg-red-500 px-1 text-[10px] font-semibold text-white"
                          style={{ left: `${nuPercentage}%` }}
                        >
                          {nu.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="divide-y rounded-md border">
                    {rijen.map((rij) => (
                      <div key={rij.id} className="flex" data-testid="rooster-actueel-rij" data-groep={rij.naam}>
                        <div className="flex w-60 shrink-0 flex-col justify-center gap-0.5 border-r bg-muted/30 px-3 py-2">
                          <span className="text-sm font-semibold leading-tight">{rij.naam}</span>
                          {rij.telnronzecentrale && (
                            <span className="text-xs text-muted-foreground">{rij.telnronzecentrale}</span>
                          )}
                        </div>
                        <div className="relative flex min-h-[96px] flex-1 items-center">
                          <Uurlijnen labels={false} />
                          {nuPercentage != null && <NuLijn percentage={nuPercentage} />}
                          {rij.segments.map(
                            ({ block, segmentStartTime, segmentEndTime, continuesFromPrev, continuesToNext }, i) => (
                              <ShiftBlock
                                key={`${block.id}-${block.van}-${block.tot}-${i}`}
                                block={block}
                                day={dag.getDate()}
                                month={dag.getMonth()}
                                year={dag.getFullYear()}
                                segmentStartTime={segmentStartTime}
                                segmentEndTime={segmentEndTime}
                                continuesFromPrev={continuesFromPrev}
                                continuesToNext={continuesToNext}
                                overnameType={block.overnameType}
                              />
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!loading && rijen.length > 0 && zonderDiensten.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Geen diensten op deze dag: {zonderDiensten.map((g) => g.naam).join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
