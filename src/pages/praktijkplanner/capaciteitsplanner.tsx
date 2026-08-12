'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CapacityRequirementList,
  type CapacityRequirementSection,
} from '@/components/praktijkplanner/CapacityRequirementList';
import { CapacityRegimeModal } from '@/components/praktijkplanner/CapacityRegimeModal';
import { CAPACITY_WEEKDAYS, CapacityWeekGrid } from '@/components/praktijkplanner/CapacityWeekGrid';
import {
  PraktijkplannerPage,
  PraktijkplannerTitleAside,
  type PraktijkplannerPageContext,
} from '@/components/praktijkplanner/PraktijkplannerPage';
import { Button } from '@/components/ui/button';
import {
  dagdelenZonderRooster,
  isDaypartSchedulable,
  weekdagenZonderRooster,
} from '@/lib/praktijkplanner/schedulable-dayparts';
import type {
  PraktijkplannerCapacityCell,
  PraktijkplannerCapacityRegime,
} from '@/types/praktijkplanner';

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
  const [regimes, setRegimes] = useState<PraktijkplannerCapacityRegime[]>([]);
  const [regimeId, setRegimeId] = useState<number | null>(null);
  const [regimesOpen, setRegimesOpen] = useState(false);
  const [cells, setCells] = useState<Map<string, CapacityDraft>>(() =>
    buildEmptyCells(data.masterData.dayparts)
  );
  // De eisen die voor de hele waarneemgroep gelden, zonder locatie.
  const [groepCells, setGroepCells] = useState<Map<string, CapacityDraft>>(() =>
    buildEmptyCells(data.masterData.dayparts)
  );
  // De normale week naast het regime, zodat bij elke eis het verschil kan worden getoond.
  const [normalCells, setNormalCells] = useState<Map<string, CapacityDraft> | null>(null);
  const [normalGroepCells, setNormalGroepCells] = useState<Map<string, CapacityDraft> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const pendingCellsRef = useRef<{
    cells: Map<string, CapacityDraft>;
    groepCells: Map<string, CapacityDraft>;
  } | null>(null);
  const locationIdRef = useRef(locationId);
  locationIdRef.current = locationId;
  const regimeIdRef = useRef(regimeId);
  regimeIdRef.current = regimeId;

  // Een eis opgeven voor een dag die de groep nooit werkt heeft geen zin; die cel was hier al
  // niet invulbaar en hoort dus ook niet in het sjabloon te staan.
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
        items: data.masterData.tasks
          .filter((task) => !task.nietLocatieGebonden)
          .map((task) => ({
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

  /** Taken die overal mogen gebeuren staan in een eigen blok, want die eis geldt groepsbreed. */
  const groepSections: CapacityRequirementSection[] = useMemo(
    () => [
      {
        key: 'tasks',
        title: 'Taken',
        items: data.masterData.tasks
          .filter((task) => task.nietLocatieGebonden)
          .map((task) => ({
            id: task.id,
            label: task.afkorting || task.omschrijving || `Taak ${task.id}`,
          })),
      },
    ],
    [data.masterData]
  );
  const heeftGroepsTaken = groepSections[0].items.length > 0;

  const gekozenRegime = useMemo(
    () => regimes.find((regime) => regime.id === regimeId) ?? null,
    [regimeId, regimes]
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
    async (
      teBewaren: { cells: Map<string, CapacityDraft>; groepCells: Map<string, CapacityDraft> },
      idplannerlocatie: number,
      idregime: number | null
    ) => {
      // Het regime hoort net als de locatie bij de vraag of dit antwoord nog gaat over wat er
      // nu op het scherm staat. Zonder die tweede vergelijking meldt een trage opslag van de
      // zomer "Opgeslagen" terwijl de secretaris allang naar de normale week is geschakeld.
      const nogActueel = () =>
        locationIdRef.current === idplannerlocatie && regimeIdRef.current === idregime;
      setSaveStatus('saving');
      try {
        const response = await fetch('/api/praktijkplanner/capaciteit', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idwaarneemgroep: groupId,
            idplannerlocatie,
            idregime,
            cells: serializeCells(teBewaren.cells),
            groepCells: serializeCells(teBewaren.groepCells),
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Opslaan mislukt.');
        if (!nogActueel()) return;
        setSaveStatus('saved');
      } catch (error) {
        if (!nogActueel()) return;
        setSaveStatus('error');
        toast.error(error instanceof Error ? error.message : 'Opslaan mislukt.');
      }
    },
    [groupId]
  );

  const flushSave = useCallback(async () => {
    if (saveInFlightRef.current) return;
    const idplannerlocatie = locationIdRef.current;
    const idregime = regimeIdRef.current;
    const cellsToSave = pendingCellsRef.current;
    if (!idplannerlocatie || !cellsToSave) return;

    pendingCellsRef.current = null;
    saveInFlightRef.current = true;
    try {
      await persist(cellsToSave, idplannerlocatie, idregime);
    } finally {
      saveInFlightRef.current = false;
      // If the user changed values during the request, persist the latest snapshot once.
      if (
        pendingCellsRef.current &&
        locationIdRef.current === idplannerlocatie &&
        regimeIdRef.current === idregime
      ) {
        void flushSave();
      }
    }
  }, [persist]);

  const scheduleSave = useCallback(
    (next: { cells: Map<string, CapacityDraft>; groepCells: Map<string, CapacityDraft> }) => {
      if (!locationIdRef.current) return;
      pendingCellsRef.current = next;
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
      setGroepCells(buildEmptyCells(data.masterData.dayparts));
      setNormalCells(null);
      setNormalGroepCells(null);
      setSaveStatus('idle');
      return;
    }

    cancelPendingSave();
    const abortController = new AbortController();
    setLoading(true);
    setSaveStatus('idle');

    const laad = async (idregime: number | null) => {
      const query = new URLSearchParams({
        idwaarneemgroep: String(groupId),
        idplannerlocatie: String(locationId),
      });
      if (idregime != null) query.set('idregime', String(idregime));
      const response = await fetch(`/api/praktijkplanner/capaciteit?${query.toString()}`, {
        credentials: 'include',
        signal: abortController.signal,
      });
      const payload = (await response.json()) as {
        cells?: PraktijkplannerCapacityCell[];
        groepCells?: PraktijkplannerCapacityCell[];
        error?: string;
      };
      if (!response.ok || !payload.cells || !payload.groepCells) {
        throw new Error(payload.error || 'Capaciteit kon niet worden geladen.');
      }
      const naarMap = (rijen: PraktijkplannerCapacityCell[]) => {
        const map = buildEmptyCells(data.masterData.dayparts);
        for (const cell of rijen) {
          map.set(keyFor(cell.weekdag, cell.iddagdeel), { ...cell });
        }
        return map;
      };
      return { cells: naarMap(payload.cells), groepCells: naarMap(payload.groepCells) };
    };

    Promise.all([laad(regimeId), regimeId == null ? Promise.resolve(null) : laad(null)])
      .then(([gekozen, normaal]) => {
        if (abortController.signal.aborted) return;
        setCells(gekozen.cells);
        setGroepCells(gekozen.groepCells);
        setNormalCells(normaal?.cells ?? null);
        setNormalGroepCells(normaal?.groepCells ?? null);
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
  }, [cancelPendingSave, data.masterData.dayparts, groupId, locationId, regimeId]);

  useEffect(() => {
    const abortController = new AbortController();
    fetch(`/api/praktijkplanner/capaciteit/regimes?idwaarneemgroep=${groupId}`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          regimes?: PraktijkplannerCapacityRegime[];
          error?: string;
        };
        if (!response.ok || !payload.regimes) {
          throw new Error(payload.error || 'De afwijkende weken konden niet worden geladen.');
        }
        return payload.regimes;
      })
      .then((loaded) => {
        if (!abortController.signal.aborted) setRegimes(loaded);
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          toast.error(
            error instanceof Error ? error.message : 'De afwijkende weken konden niet worden geladen.'
          );
        }
      });
    return () => abortController.abort();
  }, [groupId]);

  /**
   * Zet het regime op de normale week als beginpunt.
   *
   * Nodig omdat een regime de normale week vervangt: zonder dit begint elke afwijkende week
   * leeg en moet alles wat wel gewoon doorgaat opnieuw worden ingetypt.
   */
  const neemNormaleWeekOver = () => {
    if (!normalCells) return;
    const overnemen = (bron: Map<string, CapacityDraft>, huidig: Map<string, CapacityDraft>) => {
      const next = new Map<string, CapacityDraft>();
      for (const [key, cell] of bron) {
        next.set(key, { ...cell, id: huidig.get(key)?.id ?? null });
      }
      return next;
    };
    const next = overnemen(normalCells, cells);
    const nextGroep = normalGroepCells ? overnemen(normalGroepCells, groepCells) : groepCells;
    setCells(next);
    setGroepCells(nextGroep);
    scheduleSave({ cells: next, groepCells: nextGroep });
  };

  const updateCell = (key: string, update: (current: CapacityDraft) => CapacityDraft) => {
    setCells((current) => {
      const cell = current.get(key);
      if (!cell) return current;
      const next = new Map(current);
      next.set(key, update(cell));
      scheduleSave({ cells: next, groepCells });
      return next;
    });
  };

  const updateGroepCell = (key: string, update: (current: CapacityDraft) => CapacityDraft) => {
    setGroepCells((current) => {
      const cell = current.get(key);
      if (!cell) return current;
      const next = new Map(current);
      next.set(key, update(cell));
      scheduleSave({ cells, groepCells: next });
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
      <PraktijkplannerTitleAside>
        <label className="flex items-center gap-2 text-base">
          <span className="font-medium">Locatie</span>
          <select
            value={locationId ?? ''}
            onChange={(event) => setLocationId(Number(event.target.value) || null)}
            className="h-10 min-w-64 rounded border bg-background px-3 text-base"
          >
            {data.masterData.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.naam}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-base">
          <span className="font-medium">Week</span>
          <select
            value={regimeId ?? ''}
            onChange={(event) => setRegimeId(Number(event.target.value) || null)}
            className="h-10 min-w-48 rounded border bg-background px-3 text-base"
            data-testid="capaciteit-regime-keuze"
          >
            <option value="">Normale week</option>
            {regimes.map((regime) => (
              <option key={regime.id} value={regime.id}>
                {regime.naam}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="outline" size="sm" onClick={() => setRegimesOpen(true)}>
          Afwijkende weken
        </Button>
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
      </PraktijkplannerTitleAside>

      {data.masterData.locations.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Voeg eerst een plannerlocatie toe in Plannerbeheer.
        </p>
      ) : (
        <>
          {loading ? <p className="text-sm text-muted-foreground">Capaciteit laden…</p> : null}
          {gekozenRegime ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="flex-1 text-muted-foreground">
                {gekozenRegime.weken.length === 0
                  ? `${gekozenRegime.naam} geldt nog voor geen enkele week. Wijs weken aan bij Afwijkende weken.`
                  : `${gekozenRegime.naam} vervangt de normale week in ${gekozenRegime.weken.length === 1 ? '1 week' : `${gekozenRegime.weken.length} weken`}. Wat hier staat is wat er geldt.`}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!normalCells || loading}
                onClick={neemNormaleWeekOver}
                data-testid="capaciteit-neem-normale-week-over"
              >
                Neem de normale week over
              </Button>
            </div>
          ) : null}
          <CapacityWeekGrid
            dayparts={dayparts}
            verborgenWeekdagen={verborgenWeekdagen}
            isCellUnavailable={(weekday, daypart) =>
              !isDaypartSchedulable(data.masterData.schedulableDayparts ?? [], weekday.id, daypart.id)
            }
            renderCell={(weekday, daypart) => {
              const key = keyFor(weekday.id, daypart.id);
              const cell = cells.get(key);
              if (!cell) return null;
              const normaalCell = normalCells?.get(key) ?? null;
              const groepCell = groepCells.get(key);
              const normaalGroepCell = normalGroepCells?.get(key) ?? null;
              return (
                <div className="space-y-1.5">
                <CapacityRequirementList
                  mode="edit"
                  normaal={
                    normaalCell
                      ? {
                          aantalDeelnemers: normaalCell.aantalDeelnemers,
                          getValue: (sectionKey, itemId) =>
                            requirementValue(
                              normaalCell[sectionKey as RequirementField] as Requirement[],
                              itemId
                            ),
                        }
                      : undefined
                  }
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
                {heeftGroepsTaken && groepCell ? (
                  <div className="rounded border border-dashed border-border bg-muted/30 p-1.5">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Hele groep
                    </p>
                    <CapacityRequirementList
                      mode="edit"
                      toonAantalDeelnemers={false}
                      normaal={
                        normaalGroepCell
                          ? {
                              aantalDeelnemers: normaalGroepCell.aantalDeelnemers,
                              getValue: (sectionKey, itemId) =>
                                requirementValue(
                                  normaalGroepCell[sectionKey as RequirementField] as Requirement[],
                                  itemId
                                ),
                            }
                          : undefined
                      }
                      aantalDeelnemers={0}
                      onAantalDeelnemersChange={() => undefined}
                      sections={groepSections}
                      getValue={(sectionKey, itemId) =>
                        requirementValue(
                          groepCell[sectionKey as RequirementField] as Requirement[],
                          itemId
                        )
                      }
                      onValueChange={(sectionKey, itemId, value) => {
                        const field = sectionKey as RequirementField;
                        updateGroepCell(key, (current) => ({
                          ...current,
                          [field]: setRequirement(current[field] as Requirement[], itemId, value),
                        }));
                      }}
                    />
                  </div>
                ) : null}
                </div>
              );
            }}
          />
        </>
      )}

      <CapacityRegimeModal
        open={regimesOpen}
        onClose={() => setRegimesOpen(false)}
        groupId={groupId}
        regimes={regimes}
        onChanged={(volgende) => {
          setRegimes(volgende);
          // Het regime dat op het scherm staat kan zojuist zijn verwijderd. Dan terug naar de
          // normale week, anders blijft er een sjabloon staan dat nergens meer geldt.
          if (regimeId != null && !volgende.some((regime) => regime.id === regimeId)) {
            setRegimeId(null);
          }
        }}
      />
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
      >
        {(context) => <CapacityPlannerContent {...context} />}
      </PraktijkplannerPage>
    </>
  );
}
