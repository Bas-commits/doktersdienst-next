'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CapacityRequirementList } from '@/components/praktijkplanner/CapacityRequirementList';
import { CapacityWeekGrid } from '@/components/praktijkplanner/CapacityWeekGrid';
import { PlannerWeekBar } from '@/components/praktijkplanner/PlannerWeekBar';
import { useHuidigMoment } from '@/hooks/praktijkplanner/useHuidigMoment';
import {
  PraktijkplannerPage,
  type PraktijkplannerPageContext,
} from '@/components/praktijkplanner/PraktijkplannerPage';
import { addDays, formatIsoDate, startOfIsoWeek } from '@/lib/praktijkplanner/dates';
import { subscribePlannerChanged } from '@/lib/praktijkplanner/planner-change-broadcast';
import { isDaypartSchedulable } from '@/lib/praktijkplanner/schedulable-dayparts';
import type { PraktijkplannerCapacityComparison } from '@/types/praktijkplanner';

type OverviewCell = {
  datum: string;
  iddagdeel: number;
  dagdeel: string;
  totaal: PraktijkplannerCapacityComparison;
  expertises: PraktijkplannerCapacityComparison[];
  taken: PraktijkplannerCapacityComparison[];
  activiteiten: PraktijkplannerCapacityComparison[];
  specificaties: PraktijkplannerCapacityComparison[];
};

function currentWeekStart() {
  return startOfIsoWeek(formatIsoDate(new Date()));
}

function emptyComparison(key: string, label: string): PraktijkplannerCapacityComparison {
  return { key, label, gepland: 0, benodigd: 0, status: 'groen' };
}

const REFETCH_DEBOUNCE_MS = 300;

function CapacityOverviewContent({ groupId, data }: PraktijkplannerPageContext) {
  const [locationId, setLocationId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [cells, setCells] = useState<OverviewCell[]>([]);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const effectiveLocationId = locationId ?? data.masterData.locations[0]?.id ?? null;

  const dayparts = useMemo(
    () => [...data.masterData.dayparts].sort((left, right) => left.volgorde - right.volgorde),
    [data.masterData.dayparts]
  );

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  const huidigMoment = useHuidigMoment();

  const weekdayHeaders = useMemo(
    () =>
      weekDates.map((date) => (
        <span
          key={date}
          className={
            date === huidigMoment?.datum
              ? 'block normal-case tracking-normal text-emerald-600'
              : 'block normal-case tracking-normal'
          }
        >
          {new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }).format(
            new Date(`${date}T12:00:00`)
          )}
        </span>
      )),
    [huidigMoment?.datum, weekDates]
  );

  const load = useCallback(
    (options?: { quiet?: boolean }) => {
      if (!effectiveLocationId) return () => undefined;
      const abortController = new AbortController();
      const quiet = options?.quiet === true && hasLoadedRef.current;
      if (!quiet) setLoading(true);
      fetch(
        `/api/praktijkplanner/capaciteit/overzicht?idwaarneemgroep=${groupId}&idplannerlocatie=${effectiveLocationId}&start=${weekStart}&end=${weekEnd}`,
        { credentials: 'include', signal: abortController.signal }
      )
        .then(async (response) => {
          const payload = (await response.json()) as { cells?: OverviewCell[]; error?: string };
          if (!response.ok || !payload.cells) {
            throw new Error(payload.error || 'Capaciteitsoverzicht kon niet worden geladen.');
          }
          return payload.cells;
        })
        .then((loaded) => {
          if (!abortController.signal.aborted) {
            setCells(loaded);
            hasLoadedRef.current = true;
          }
        })
        .catch(() => {
          if (!abortController.signal.aborted && !quiet) setCells([]);
        })
        .finally(() => {
          if (!abortController.signal.aborted && !quiet) setLoading(false);
        });
      return () => abortController.abort();
    },
    [effectiveLocationId, groupId, weekEnd, weekStart]
  );

  useEffect(() => {
    hasLoadedRef.current = false;
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let debounceTimer: number | undefined;
    const scheduleQuietRefetch = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        void load({ quiet: true });
      }, REFETCH_DEBOUNCE_MS);
    };

    const unsubscribe = subscribePlannerChanged(groupId, () => {
      scheduleQuietRefetch();
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleQuietRefetch();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsubscribe();
      window.clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [groupId, load]);

  const cellByKey = useMemo(() => {
    const map = new Map<string, OverviewCell>();
    for (const cell of cells) {
      map.set(`${cell.datum}:${cell.iddagdeel}`, cell);
    }
    return map;
  }, [cells]);

  if (!data.isManager) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Deze pagina is alleen beschikbaar voor secretarissen en beheerders.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/*
        De locatiekeuze hoort naast de weken en niet in de paginakop: het is een filter op
        wat je in dit rooster ziet, net als de week die je kiest.
      */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <PlannerWeekBar weekStart={weekStart} onWeekStartChange={setWeekStart} />
        </div>
        <label className="flex shrink-0 items-center gap-2 text-base">
          <span className="font-medium">Locatie</span>
          <select
            value={effectiveLocationId ?? ''}
            onChange={(event) => setLocationId(Number(event.target.value) || null)}
            className="h-10 min-w-56 rounded border bg-background px-3 text-base"
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
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Voeg eerst een plannerlocatie toe in Plannerbeheer.
        </p>
      ) : (
        <>
          {loading ? <p className="text-sm text-muted-foreground">Overzicht laden…</p> : null}
          <CapacityWeekGrid
            dayparts={dayparts}
            weekdayHeaders={weekdayHeaders}
            isCellUnavailable={(weekday, daypart) =>
              !isDaypartSchedulable(data.masterData.schedulableDayparts ?? [], weekday.id, daypart.id)
            }
            isCurrentCell={(weekday, daypart) =>
              weekDates[weekday.id - 1] === huidigMoment?.datum &&
              daypart.volgorde === huidigMoment.volgorde
            }
            renderCell={(weekday, daypart) => {
              const date = weekDates[weekday.id - 1];
              const cell = cellByKey.get(`${date}:${daypart.id}`);
              const totaal =
                cell?.totaal ??
                emptyComparison(`totaal:${date}:${daypart.id}`, 'Aantal deelnemers');
              return (
                <CapacityRequirementList
                  mode="status"
                  totaal={totaal}
                  sections={[
                    { key: 'expertises', title: 'Expertises', items: cell?.expertises ?? [] },
                    { key: 'taken', title: 'Taken', items: cell?.taken ?? [] },
                    { key: 'activiteiten', title: 'Activiteiten', items: cell?.activiteiten ?? [] },
                    { key: 'specificaties', title: 'Specificaties', items: cell?.specificaties ?? [] },
                  ]}
                />
              );
            }}
          />
        </>
      )}
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
