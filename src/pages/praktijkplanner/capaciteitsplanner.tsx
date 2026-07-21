'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CapacityRequirementList,
  type CapacityRequirementSection,
} from '@/components/praktijkplanner/CapacityRequirementList';
import { CAPACITY_WEEKDAYS, CapacityWeekGrid } from '@/components/praktijkplanner/CapacityWeekGrid';
import { PraktijkplannerPage, type PraktijkplannerPageContext } from '@/components/praktijkplanner/PraktijkplannerPage';
import { isDaypartSchedulable } from '@/lib/praktijkplanner/schedulable-dayparts';
import type { PraktijkplannerCapacityCell } from '@/types/praktijkplanner';

type Requirement = { id: number; aantal: number };
type CapacityDraft = Omit<PraktijkplannerCapacityCell, 'id'> & { id: number | null };
type RequirementField = 'expertises' | 'tasks' | 'activities' | 'specifications';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_DEBOUNCE_MS = 500;

function keyFor(weekdag: number, iddagdeel: number) {
  return `${weekdag}:${iddagdeel}`;
}

function buildEmptyCells(
  dayparts: PraktijkplannerPageContext['data']['masterData']['dayparts']
): Map<string, CapacityDraft> {
  const map = new Map<string, CapacityDraft>();
  for (const weekday of CAPACITY_WEEKDAYS) {
    for (const daypart of dayparts) {
      map.set(keyFor(weekday.id, daypart.id), {
        id: null,
        weekdag: weekday.id,
        iddagdeel: daypart.id,
        aantalDeelnemers: 0,
        expertises: [],
        tasks: [],
        activities: [],
        specifications: [],
      });
    }
  }
  return map;
}

function serializeCells(cells: Map<string, CapacityDraft>) {
  return [...cells.values()].map((cell) => ({
    weekdag: cell.weekdag,
    iddagdeel: cell.iddagdeel,
    aantalDeelnemers: cell.aantalDeelnemers,
    expertises: cell.expertises,
    tasks: cell.tasks,
    activities: cell.activities,
    specifications: cell.specifications,
  }));
}

function requirementValue(items: Requirement[], id: number) {
  return items.find((item) => item.id === id)?.aantal ?? 0;
}

function setRequirement(items: Requirement[], id: number, aantal: number): Requirement[] {
  if (aantal <= 0) return items.filter((item) => item.id !== id);
  const current = items.findIndex((item) => item.id === id);
  if (current < 0) return [...items, { id, aantal }];
  return items.map((item) => (item.id === id ? { ...item, aantal } : item));
}

function CapacityPlannerContent(context: PraktijkplannerPageContext) {
  const { groupId, data } = context;
  const [locationId, setLocationId] = useState<number | null>(null);
  const [cells, setCells] = useState<Map<string, CapacityDraft>>(() =>
    buildEmptyCells(data.masterData.dayparts)
  );
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const pendingCellsRef = useRef<Map<string, CapacityDraft> | null>(null);
  const locationIdRef = useRef(locationId);
  locationIdRef.current = locationId;

  const dayparts = useMemo(
    () => [...data.masterData.dayparts].sort((left, right) => left.volgorde - right.volgorde),
    [data.masterData.dayparts]
  );

  const requirementSections: CapacityRequirementSection[] = useMemo(
    () => [
      {
        key: 'expertises',
        title: 'Expertises',
        items: data.masterData.expertises.map((item) => ({
          id: item.id,
          label: item.afkorting || item.naam,
        })),
      },
      {
        key: 'tasks',
        title: 'Taken',
        items: data.masterData.tasks.map((task) => ({
          id: task.id,
          label: task.afkorting || task.omschrijving || `Taak ${task.id}`,
        })),
      },
      {
        key: 'activities',
        title: 'Activiteiten',
        items: data.masterData.activities.map((item) => ({
          id: item.id,
          label: item.afkorting || item.naam,
        })),
      },
      {
        key: 'specifications',
        title: 'Specificaties',
        items: data.masterData.specifications.map((item) => ({
          id: item.id,
          label: item.afkorting || item.naam,
        })),
      },
    ],
    [data.masterData]
  );

  useEffect(() => {
    if (locationId == null && data.masterData.locations[0]) {
      setLocationId(data.masterData.locations[0].id);
    }
  }, [data.masterData.locations, locationId]);

  const cancelPendingSave = useCallback(() => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingCellsRef.current = null;
  }, []);

  const persist = useCallback(
    async (cellsToSave: Map<string, CapacityDraft>, idplannerlocatie: number) => {
      setSaveStatus('saving');
      try {
        const response = await fetch('/api/praktijkplanner/capaciteit', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idwaarneemgroep: groupId,
            idplannerlocatie,
            cells: serializeCells(cellsToSave),
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Opslaan mislukt.');
        if (locationIdRef.current !== idplannerlocatie) return;
        setSaveStatus('saved');
      } catch (error) {
        if (locationIdRef.current !== idplannerlocatie) return;
        setSaveStatus('error');
        toast.error(error instanceof Error ? error.message : 'Opslaan mislukt.');
      }
    },
    [groupId]
  );

  const flushSave = useCallback(async () => {
    if (saveInFlightRef.current) return;
    const idplannerlocatie = locationIdRef.current;
    const cellsToSave = pendingCellsRef.current;
    if (!idplannerlocatie || !cellsToSave) return;

    pendingCellsRef.current = null;
    saveInFlightRef.current = true;
    try {
      await persist(cellsToSave, idplannerlocatie);
    } finally {
      saveInFlightRef.current = false;
      // If the user changed values during the request, persist the latest snapshot once.
      if (pendingCellsRef.current && locationIdRef.current === idplannerlocatie) {
        void flushSave();
      }
    }
  }, [persist]);

  const scheduleSave = useCallback(
    (nextCells: Map<string, CapacityDraft>) => {
      if (!locationIdRef.current) return;
      pendingCellsRef.current = nextCells;
      if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void flushSave();
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave]
  );

  useEffect(() => {
    if (!locationId) {
      cancelPendingSave();
      setCells(buildEmptyCells(data.masterData.dayparts));
      setSaveStatus('idle');
      return;
    }

    cancelPendingSave();
    const abortController = new AbortController();
    setLoading(true);
    setSaveStatus('idle');
    fetch(`/api/praktijkplanner/capaciteit?idwaarneemgroep=${groupId}&idplannerlocatie=${locationId}`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { cells?: PraktijkplannerCapacityCell[]; error?: string };
        if (!response.ok || !payload.cells) throw new Error(payload.error || 'Capaciteit kon niet worden geladen.');
        return payload.cells;
      })
      .then((loaded) => {
        if (abortController.signal.aborted) return;
        const next = buildEmptyCells(data.masterData.dayparts);
        for (const cell of loaded) {
          next.set(keyFor(cell.weekdag, cell.iddagdeel), { ...cell });
        }
        setCells(next);
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          toast.error(error instanceof Error ? error.message : 'Capaciteit kon niet worden geladen.');
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false);
      });

    return () => {
      abortController.abort();
      cancelPendingSave();
    };
  }, [cancelPendingSave, data.masterData.dayparts, groupId, locationId]);

  const updateCell = (key: string, update: (current: CapacityDraft) => CapacityDraft) => {
    setCells((current) => {
      const cell = current.get(key);
      if (!cell) return current;
      const next = new Map(current);
      next.set(key, update(cell));
      scheduleSave(next);
      return next;
    });
  };

  if (!data.isManager) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Deze pagina is alleen beschikbaar voor secretarissen en beheerders.
      </p>
    );
  }

  const saveStatusLabel =
    saveStatus === 'saving'
      ? 'Opslaan…'
      : saveStatus === 'saved'
        ? 'Opgeslagen'
        : saveStatus === 'error'
          ? 'Opslaan mislukt'
          : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Locatie</span>
          <select
            value={locationId ?? ''}
            onChange={(event) => setLocationId(Number(event.target.value) || null)}
            className="h-9 min-w-64 rounded border bg-background px-2"
          >
            {data.masterData.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.naam}
              </option>
            ))}
          </select>
        </label>
        {saveStatusLabel ? (
          <p
            className={[
              'text-sm',
              saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground',
            ].join(' ')}
            aria-live="polite"
          >
            {saveStatusLabel}
          </p>
        ) : null}
      </div>

      {data.masterData.locations.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Voeg eerst een plannerlocatie toe in Plannerbeheer.
        </p>
      ) : (
        <>
          {loading ? <p className="text-sm text-muted-foreground">Capaciteit laden…</p> : null}
          <CapacityWeekGrid
            dayparts={dayparts}
            isCellUnavailable={(weekday, daypart) =>
              !isDaypartSchedulable(data.masterData.schedulableDayparts ?? [], weekday.id, daypart.id)
            }
            renderCell={(weekday, daypart) => {
              const key = keyFor(weekday.id, daypart.id);
              const cell = cells.get(key);
              if (!cell) return null;
              return (
                <CapacityRequirementList
                  mode="edit"
                  aantalDeelnemers={cell.aantalDeelnemers}
                  onAantalDeelnemersChange={(value) =>
                    updateCell(key, (current) => ({ ...current, aantalDeelnemers: value }))
                  }
                  sections={requirementSections}
                  getValue={(sectionKey, itemId) =>
                    requirementValue(cell[sectionKey as RequirementField] as Requirement[], itemId)
                  }
                  onValueChange={(sectionKey, itemId, value) => {
                    const field = sectionKey as RequirementField;
                    updateCell(key, (current) => ({
                      ...current,
                      [field]: setRequirement(current[field] as Requirement[], itemId, value),
                    }));
                  }}
                />
              );
            }}
          />
        </>
      )}
    </div>
  );
}

export default function CapaciteitsplannerPage() {
  return (
    <>
      <Head>
        <title>Capaciteit planner | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage
        title="Capaciteit planner"
        description="Stel per locatie, weekdag en dagdeel de gewenste capaciteit in."
      >
        {(context) => <CapacityPlannerContent {...context} />}
      </PraktijkplannerPage>
    </>
  );
}
