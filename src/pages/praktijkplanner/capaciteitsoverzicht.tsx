'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PraktijkplannerPage, type PraktijkplannerPageContext } from '@/components/praktijkplanner/PraktijkplannerPage';
import { PlannerWeekNavigation } from '@/components/praktijkplanner/PlannerWeekNavigation';
import { addDays, formatIsoDate, startOfIsoWeek } from '@/lib/praktijkplanner/dates';

type Comparison = {
  key: string;
  label: string;
  gepland: number;
  benodigd: number;
  status: 'groen' | 'oranje' | 'rood';
};

type OverviewCell = {
  datum: string;
  iddagdeel: number;
  dagdeel: string;
  totaal: Comparison;
  expertises: Comparison[];
  taken: Comparison[];
  activiteiten: Comparison[];
  specificaties: Comparison[];
};

const STATUS_CLASS: Record<Comparison['status'], string> = {
  groen: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  oranje: 'bg-amber-100 text-amber-800 ring-amber-300',
  rood: 'bg-red-100 text-red-800 ring-red-300',
};

function currentWeekStart() {
  return startOfIsoWeek(formatIsoDate(new Date()));
}

function ComparisonList({ title, items }: { title: string; items: Comparison[] }) {
  if (items.length === 0) return null;
  return (
    <details className="border-t pt-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{title}</summary>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate">{item.label}</span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 font-semibold ring-1 ${STATUS_CLASS[item.status]}`}>
              {item.gepland}/{item.benodigd}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function CapacityOverviewContent({ groupId, data }: PraktijkplannerPageContext) {
  const [locationId, setLocationId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [cells, setCells] = useState<OverviewCell[]>([]);
  const [loading, setLoading] = useState(false);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const effectiveLocationId = locationId ?? data.masterData.locations[0]?.id ?? null;

  const load = useCallback(() => {
    if (!effectiveLocationId) return;
    const abortController = new AbortController();
    setLoading(true);
    fetch(
      `/api/praktijkplanner/capaciteit/overzicht?idwaarneemgroep=${groupId}&idplannerlocatie=${effectiveLocationId}&start=${weekStart}&end=${weekEnd}`,
      { credentials: 'include', signal: abortController.signal }
    )
      .then(async (response) => {
        const payload = (await response.json()) as { cells?: OverviewCell[]; error?: string };
        if (!response.ok || !payload.cells) throw new Error(payload.error || 'Capaciteitsoverzicht kon niet worden geladen.');
        return payload.cells;
      })
      .then((loaded) => {
        if (!abortController.signal.aborted) setCells(loaded);
      })
      .catch(() => {
        if (!abortController.signal.aborted) setCells([]);
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false);
      });
    return () => abortController.abort();
  }, [effectiveLocationId, groupId, weekEnd, weekStart]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const byDate = useMemo(() => {
    const map = new Map<string, OverviewCell[]>();
    for (const cell of cells) {
      const entries = map.get(cell.datum) ?? [];
      entries.push(cell);
      map.set(cell.datum, entries);
    }
    return map;
  }, [cells]);

  if (!data.isManager) {
    return <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Deze pagina is alleen beschikbaar voor secretarissen en beheerders.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PlannerWeekNavigation weekStart={weekStart} onWeekStartChange={setWeekStart} />
        <label className="flex items-center gap-2 rounded-xl border bg-card p-2 text-sm shadow-sm">
          <span className="font-medium">Locatie</span>
          <select
            value={effectiveLocationId ?? ''}
            onChange={(event) => setLocationId(Number(event.target.value) || null)}
            className="h-8 min-w-56 rounded border bg-background px-2"
          >
            {data.masterData.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.naam}
              </option>
            ))}
          </select>
        </label>
      </div>

      {data.masterData.locations.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">Voeg eerst een plannerlocatie toe in Plannerbeheer.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <div className="grid min-w-[1120px] grid-cols-7">
            {Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)).map((date) => {
              const dayCells = byDate.get(date) ?? [];
              return (
                <section key={date} className="border-r last:border-r-0">
                  <header className="border-b bg-muted/40 p-3 text-center text-sm font-semibold">
                    {new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }).format(
                      new Date(`${date}T12:00:00`)
                    )}
                  </header>
                  <div className="space-y-2 p-2">
                    {dayCells.map((cell) => (
                      <article key={`${cell.datum}-${cell.iddagdeel}`} className="rounded-lg border p-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{cell.dagdeel}</span>
                          <span className={`rounded px-2 py-1 text-xs font-bold ring-1 ${STATUS_CLASS[cell.totaal.status]}`}>
                            {cell.totaal.gepland}/{cell.totaal.benodigd}
                          </span>
                        </div>
                        <ComparisonList title="Expertises" items={cell.expertises} />
                        <ComparisonList title="Taken" items={cell.taken} />
                        <ComparisonList title="Activiteiten" items={cell.activiteiten} />
                        <ComparisonList title="Specificaties" items={cell.specificaties} />
                      </article>
                    ))}
                    {dayCells.length === 0 && !loading ? <p className="p-2 text-xs text-muted-foreground">Geen dagdelen.</p> : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
      {loading ? <p className="text-sm text-muted-foreground">Overzicht laden…</p> : null}
    </div>
  );
}

export default function CapaciteitsoverzichtPage() {
  return (
    <>
      <Head>
        <title>Capaciteit overzicht | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage
        title="Capaciteit overzicht"
        description="Vergelijk de ingeplande bezetting met de benodigde capaciteit."
      >
        {(context) => <CapacityOverviewContent {...context} />}
      </PraktijkplannerPage>
    </>
  );
}
