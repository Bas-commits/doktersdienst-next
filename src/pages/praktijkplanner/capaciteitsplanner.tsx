'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { PraktijkplannerPage, type PraktijkplannerPageContext } from '@/components/praktijkplanner/PraktijkplannerPage';
import type { PraktijkplannerCapacityCell } from '@/types/praktijkplanner';

type Requirement = { id: number; aantal: number };
type CapacityDraft = Omit<PraktijkplannerCapacityCell, 'id'> & { id: number | null };
type RequirementField = 'expertises' | 'tasks' | 'activities' | 'specifications';
type RequirementItem = { id: number; naam?: string | null; afkorting?: string | null };

const WEEKDAYS = [
  { id: 1, label: 'Maandag' },
  { id: 2, label: 'Dinsdag' },
  { id: 3, label: 'Woensdag' },
  { id: 4, label: 'Donderdag' },
  { id: 5, label: 'Vrijdag' },
  { id: 6, label: 'Zaterdag' },
  { id: 7, label: 'Zondag' },
];

function keyFor(weekdag: number, iddagdeel: number) {
  return `${weekdag}:${iddagdeel}`;
}

function buildEmptyCells(
  dayparts: PraktijkplannerPageContext['data']['masterData']['dayparts']
): Map<string, CapacityDraft> {
  const map = new Map<string, CapacityDraft>();
  for (const weekday of WEEKDAYS) {
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dayparts = useMemo(
    () => [...data.masterData.dayparts].sort((left, right) => left.volgorde - right.volgorde),
    [data.masterData.dayparts]
  );

  useEffect(() => {
    if (locationId == null && data.masterData.locations[0]) {
      setLocationId(data.masterData.locations[0].id);
    }
  }, [data.masterData.locations, locationId]);

  const load = useCallback(() => {
    if (!locationId) {
      setCells(buildEmptyCells(data.masterData.dayparts));
      return;
    }
    const abortController = new AbortController();
    setLoading(true);
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
    return () => abortController.abort();
  }, [data.masterData.dayparts, groupId, locationId]);

  useEffect(() => load(), [load]);

  const updateCell = (key: string, update: (current: CapacityDraft) => CapacityDraft) => {
    setCells((current) => {
      const next = new Map(current);
      const cell = next.get(key);
      if (cell) next.set(key, update(cell));
      return next;
    });
  };

  const selectedCell = selectedKey ? cells.get(selectedKey) ?? null : null;
  const selectedDaypart = selectedCell
    ? dayparts.find((daypart) => daypart.id === selectedCell.iddagdeel)
    : null;
  const selectedWeekday = selectedCell
    ? WEEKDAYS.find((weekday) => weekday.id === selectedCell.weekdag)
    : null;

  const save = useCallback(async () => {
    if (!locationId) return;
    setSaving(true);
    try {
      const response = await fetch('/api/praktijkplanner/capaciteit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          idplannerlocatie: locationId,
          cells: [...cells.values()].map((cell) => ({
            weekdag: cell.weekdag,
            iddagdeel: cell.iddagdeel,
            aantalDeelnemers: cell.aantalDeelnemers,
            expertises: cell.expertises,
            tasks: cell.tasks,
            activities: cell.activities,
            specifications: cell.specifications,
          })),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Opslaan mislukt.');
      toast.success('Capaciteitsplanner opgeslagen.');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  }, [cells, groupId, load, locationId]);

  if (!data.isManager) {
    return <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Deze pagina is alleen beschikbaar voor secretarissen en beheerders.</p>;
  }

  const requirementGroups: Array<{ field: RequirementField; title: string; items: RequirementItem[] }> = [
    { field: 'expertises', title: 'Expertises', items: data.masterData.expertises },
    {
      field: 'tasks',
      title: 'Taken',
      items: data.masterData.tasks.map((task) => ({
        id: task.id,
        naam: task.afkorting || task.omschrijving || `Taak ${task.id}`,
      })),
    },
    { field: 'activities', title: 'Activiteiten', items: data.masterData.activities },
    { field: 'specifications', title: 'Specificaties', items: data.masterData.specifications },
  ];

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
        <button
          type="button"
          disabled={!locationId || saving}
          onClick={save}
          className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <Save className="size-4" /> {saving ? 'Opslaan…' : 'Opslaan'}
        </button>
      </div>

      {data.masterData.locations.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">Voeg eerst een plannerlocatie toe in Plannerbeheer.</p>
      ) : (
        <>
          {loading ? <p className="text-sm text-muted-foreground">Capaciteit laden…</p> : null}
          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">Dagdeel</th>
                  {WEEKDAYS.map((weekday) => (
                    <th key={weekday.id} className="p-3 text-center">{weekday.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayparts.map((daypart) => (
                  <tr key={daypart.id} className="border-t">
                    <td className="p-3 font-medium">{daypart.naam}</td>
                    {WEEKDAYS.map((weekday) => {
                      const key = keyFor(weekday.id, daypart.id);
                      const cell = cells.get(key);
                      return (
                        <td key={key} className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedKey(key)}
                            className={[
                              'min-w-20 rounded border px-2 py-2 text-sm transition hover:bg-muted',
                              selectedKey === key ? 'border-primary ring-2 ring-primary/30' : '',
                            ].join(' ')}
                          >
                            {cell?.aantalDeelnemers ?? 0} arts{(cell?.aantalDeelnemers ?? 0) === 1 ? '' : 'en'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedCell && selectedKey && selectedDaypart && selectedWeekday ? (
        <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <h2 className="font-semibold">{selectedWeekday.label} · {selectedDaypart.naam}</h2>
            <p className="text-sm text-muted-foreground">Vul de benodigde capaciteit voor dit dagdeel in.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Aantal deelnemers</span>
            <input
              type="number"
              min="0"
              value={selectedCell.aantalDeelnemers}
              onChange={(event) =>
                updateCell(selectedKey, (current) => ({
                  ...current,
                  aantalDeelnemers: Math.max(0, Number(event.target.value) || 0),
                }))
              }
              className="h-9 w-20 rounded border bg-background px-2"
            />
          </label>
          <div className="grid gap-4 lg:grid-cols-2">
            {requirementGroups.map(({ field, title, items }) => (
              <div key={field} className="rounded-lg border p-3">
                <h3 className="mb-2 text-sm font-semibold">{title}</h3>
                <div className="space-y-2">
                  {items.map((item) => {
                    const requirements = selectedCell[field] as Requirement[];
                    const currentValue = requirementValue(requirements, item.id);
                    return (
                      <label key={item.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{item.afkorting || item.naam}</span>
                        <input
                          type="number"
                          min="0"
                          value={currentValue}
                          onChange={(event) => {
                            const aantal = Math.max(0, Number(event.target.value) || 0);
                            updateCell(selectedKey, (current) => ({
                              ...current,
                              [field]: setRequirement(
                                current[field] as Requirement[],
                                item.id,
                                aantal
                              ),
                            }));
                          }}
                          className="h-8 w-16 rounded border bg-background px-2 text-right"
                        />
                      </label>
                    );
                  })}
                  {items.length === 0 ? <p className="text-xs text-muted-foreground">Geen stamgegevens.</p> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
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
