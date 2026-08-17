'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CapacityRequirementList } from './CapacityRequirementList';
import { CapacityWeekGrid } from './CapacityWeekGrid';
import { useHuidigMoment } from '@/hooks/praktijkplanner/useHuidigMoment';
import { addDays } from '@/lib/praktijkplanner/dates';
import { subscribePlannerChanged } from '@/lib/praktijkplanner/planner-change-broadcast';
import {
  dagdelenZonderRooster,
  isDaypartSchedulable,
  weekdagenZonderRooster,
} from '@/lib/praktijkplanner/schedulable-dayparts';
import type { PraktijkplannerContextData } from '@/hooks/praktijkplanner/usePraktijkplannerContext';
import type { PraktijkplannerCapacityComparison } from '@/types/praktijkplanner';

export type CapacityOverviewCell = {
  datum: string;
  iddagdeel: number;
  dagdeel: string;
  /** Het regime dat deze week geldt, of leeg als het de normale week is. */
  regime: string | null;
  totaal: PraktijkplannerCapacityComparison;
  expertises: PraktijkplannerCapacityComparison[];
  taken: PraktijkplannerCapacityComparison[];
  activiteiten: PraktijkplannerCapacityComparison[];
  specificaties: PraktijkplannerCapacityComparison[];
};

const REFETCH_DEBOUNCE_MS = 300;

function emptyComparison(key: string, label: string): PraktijkplannerCapacityComparison {
  return { key, label, gepland: 0, benodigd: 0, status: 'groen' };
}

/**
 * De cellen van het capaciteitsoverzicht voor een week, met de locatiekeuze erbij.
 *
 * Dit zat in de pagina zelf. Het staat hier los omdat hetzelfde overzicht ook als paneel naast
 * het weekrooster van de Activiteiten planner komt te staan, en twee kopieën van dit ophalen
 * lopen bij de eerste wijziging uit elkaar.
 */
export function useCapacityOverview(
  groupId: number,
  data: PraktijkplannerContextData,
  weekStart: string
) {
  const [locationId, setLocationId] = useState<number | null>(null);
  const [cells, setCells] = useState<CapacityOverviewCell[]>([]);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const effectiveLocationId = locationId ?? data.masterData.locations[0]?.id ?? null;

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
          const payload = (await response.json()) as {
            cells?: CapacityOverviewCell[];
            error?: string;
          };
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

  // Dit overzicht toont precies een week, dus het regime geldt voor alle cellen tegelijk.
  // Daarom staat het boven het rooster en niet in elke cel: naast gepland en benodigd zou een
  // derde getal per cel niet meer te lezen zijn.
  const weekRegime = useMemo(() => cells.find((cell) => cell.regime)?.regime ?? null, [cells]);

  return { cells, loading, locationId: effectiveLocationId, setLocationId, weekRegime };
}

/** De keuzelijst met plannerlocaties. Staat op de pagina in de kop en in het paneel erboven. */
export function CapacityLocatieKeuze({
  locations,
  value,
  onChange,
  compact = false,
}: {
  locations: PraktijkplannerContextData['masterData']['locations'];
  value: number | null;
  onChange: (id: number | null) => void;
  /** In het paneel is er geen plek voor een lijst van 224 pixels naast de weekbalk. */
  compact?: boolean;
}) {
  return (
    <label className={compact ? 'flex min-w-0 items-center gap-2 text-sm' : 'flex min-w-0 items-center gap-2 text-base'}>
      <span className="font-medium">Locatie</span>
      {/*
        Vaste breedte in plaats van min-w: de lijst groeide mee met de langste locatienaam,
        en dan paste hij naast de weekbalk net niet meer en viel hij op een eigen regel.
      */}
      <select
        value={value ?? ''}
        onChange={(event) => onChange(Number(event.target.value) || null)}
        className={
          compact
            ? 'h-8 w-40 max-w-full rounded border bg-background px-2 text-sm'
            : 'h-10 w-56 max-w-full rounded border bg-background px-3 text-base'
        }
      >
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.naam}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Het rooster zelf: een week met per dagdeel wat er gepland staat tegenover wat er nodig is. */
export function CapacityOverviewGrid({
  data,
  weekStart,
  cells,
}: {
  data: PraktijkplannerContextData;
  weekStart: string;
  cells: CapacityOverviewCell[];
}) {
  const huidigMoment = useHuidigMoment();

  // Dagen en dagdelen die de groep nooit gebruikt horen hier net zo goed niet thuis als in de
  // planners: anders vergelijkt dit scherm een bezetting met een eis die niet bestaat.
  const verborgenWeekdagen = useMemo(
    () => weekdagenZonderRooster(data.masterData.schedulableDayparts ?? []),
    [data.masterData.schedulableDayparts]
  );
  const dayparts = useMemo(() => {
    const weg = dagdelenZonderRooster(
      data.masterData.schedulableDayparts ?? [],
      data.masterData.dayparts.map((daypart) => daypart.id)
    );
    return [...data.masterData.dayparts]
      .filter((daypart) => !weg.has(daypart.id))
      .sort((left, right) => left.volgorde - right.volgorde);
  }, [data.masterData.dayparts, data.masterData.schedulableDayparts]);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

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

  const cellByKey = useMemo(() => {
    const map = new Map<string, CapacityOverviewCell>();
    for (const cell of cells) {
      map.set(`${cell.datum}:${cell.iddagdeel}`, cell);
    }
    return map;
  }, [cells]);

  return (
    <CapacityWeekGrid
      dayparts={dayparts}
      weekdayHeaders={weekdayHeaders}
      verborgenWeekdagen={verborgenWeekdagen}
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
          cell?.totaal ?? emptyComparison(`totaal:${date}:${daypart.id}`, 'Aantal deelnemers');
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
  );
}

/**
 * Het hele capaciteitsoverzicht als paneel naast het weekrooster.
 *
 * Alleen om te kijken, net als op de eigen pagina: er valt hier niets te plannen of op te
 * slaan. De locatiekeuze staat binnen het paneel en niet in de paginakop, want die kop hoort
 * bij het scherm links en zou anders twee dingen tegelijk aansturen.
 */
export function CapacityOverviewPanel({
  groupId,
  data,
  weekStart,
}: {
  groupId: number;
  data: PraktijkplannerContextData;
  weekStart: string;
}) {
  const { cells, loading, locationId, setLocationId, weekRegime } = useCapacityOverview(
    groupId,
    data,
    weekStart
  );

  if (data.masterData.locations.length === 0) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        Voeg eerst een plannerlocatie toe in Plannerbeheer.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CapacityLocatieKeuze
          locations={data.masterData.locations}
          value={locationId}
          onChange={setLocationId}
          compact
        />
        {loading ? <span className="text-xs text-muted-foreground">Laden…</span> : null}
      </div>
      <CapacityRegimeRegel regime={weekRegime} />
      {/*
        Het rooster scrollt binnen het paneel, niet de pagina eromheen. Anders schuift het
        weekrooster links mee omhoog zodra je hier naar de avond kijkt.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CapacityOverviewGrid data={data} weekStart={weekStart} cells={cells} />
      </div>
    </div>
  );
}

/** De regel die zegt dat deze week een ander regime geldt, of niets als dat niet zo is. */
export function CapacityRegimeRegel({ regime }: { regime: string | null }) {
  if (!regime) return null;
  return (
    <p
      className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground"
      data-testid="capaciteit-overzicht-regime"
    >
      Deze week geldt {regime}, niet de normale bezetting.
    </p>
  );
}
