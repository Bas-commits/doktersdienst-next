'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Mail, Repeat2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PlannerChipPalette } from '@/components/praktijkplanner/PlannerChipPalette';
import { PlannerDaypartGrid } from '@/components/praktijkplanner/PlannerDaypartGrid';
import { PraktijkplannerPage, type PraktijkplannerPageContext } from '@/components/praktijkplanner/PraktijkplannerPage';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { usePlannerHolidays } from '@/hooks/praktijkplanner/usePlannerHolidays';
import { addDays, formatIsoDate, startOfIsoWeek } from '@/lib/praktijkplanner/dates';
import type { PraktijkplannerPlanningSlot } from '@/types/praktijkplanner';

type PendingSlot = {
  iddeelnemer: number;
  datum: string;
  iddagdeel: number;
  idactiviteit: number | null;
  idactiviteitspecificatie: number | null;
  idplannerlocatie: number | null;
  idbeschikbaarheidstype: number | null;
  taskIds: number[];
  version: number | null;
};

type RecurrenceSeries = {
  id: number;
  iddeelnemer: number;
  startdatum: string;
  einddatum: string;
  frequentieWeken: number;
};

function slotKey(iddeelnemer: number, datum: string, iddagdeel: number) {
  return `${iddeelnemer}:${datum}:${iddagdeel}`;
}

function currentWeekStart() {
  return startOfIsoWeek(formatIsoDate(new Date()));
}

function ActivitiesContent({ groupId, data }: PraktijkplannerPageContext) {
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [slots, setSlots] = useState<PraktijkplannerPlanningSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [pending, setPending] = useState<Map<string, PendingSlot>>(new Map());
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [selectedSpecificationId, setSelectedSpecificationId] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<number | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [clearMode, setClearMode] = useState(false);
  const [showDay, setShowDay] = useState(true);
  const [showNight, setShowNight] = useState(true);
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
  const [copyTargetDate, setCopyTargetDate] = useState(addDays(currentWeekStart(), 7));
  const [repeatEndDate, setRepeatEndDate] = useState(addDays(currentWeekStart(), 28));
  const [frequencyWeeks, setFrequencyWeeks] = useState('1');
  const [saving, setSaving] = useState(false);
  const [participantFilter, setParticipantFilter] = useState<number | 'all'>('all');
  const [zoom, setZoom] = useState('100');
  const [series, setSeries] = useState<RecurrenceSeries[]>([]);
  const [editingSeries, setEditingSeries] = useState<RecurrenceSeries | null>(null);

  const end = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const holidays = usePlannerHolidays(weekStart, end);
  const visibleDayparts = useMemo(
    () =>
      data.masterData.dayparts.filter((daypart) =>
        daypart.volgorde >= 4 ? showNight : showDay
      ),
    [data.masterData.dayparts, showDay, showNight]
  );
  const visibleParticipants = useMemo(
    () =>
      participantFilter === 'all'
        ? data.participants
        : data.participants.filter((participant) => participant.id === participantFilter),
    [data.participants, participantFilter]
  );

  useEffect(() => {
    if (selectedParticipantId != null || data.participants.length === 0) return;
    setSelectedParticipantId(data.participants[0].id);
  }, [data.participants, selectedParticipantId]);

  useEffect(() => {
    setSelectedSpecificationId((current) => {
      if (current == null) return null;
      return data.masterData.specifications.some(
        (specification) =>
          specification.id === current && specification.idactiviteit === selectedActivityId
      )
        ? current
        : null;
    });
  }, [data.masterData.specifications, selectedActivityId]);

  useEffect(() => {
    const abortController = new AbortController();
    fetch(`/api/praktijkplanner/voorkeuren?idwaarneemgroep=${groupId}`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { toonDag?: boolean; toonNacht?: boolean };
        if (!response.ok) return;
        if (typeof payload.toonDag === 'boolean') setShowDay(payload.toonDag);
        if (typeof payload.toonNacht === 'boolean') setShowNight(payload.toonNacht);
      })
      .catch(() => undefined);
    return () => abortController.abort();
  }, [groupId]);

  const updateVisibility = useCallback(
    (nextDay: boolean, nextNight: boolean) => {
      setShowDay(nextDay);
      setShowNight(nextNight);
      void fetch('/api/praktijkplanner/voorkeuren', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          toonDag: nextDay,
          toonNacht: nextNight,
        }),
      });
    },
    [groupId]
  );

  const loadSlots = useCallback(() => {
    const abortController = new AbortController();
    setLoadingSlots(true);
    setSlotError(null);
    fetch(
      `/api/praktijkplanner/activiteiten?idwaarneemgroep=${groupId}&start=${weekStart}&end=${end}`,
      { credentials: 'include', signal: abortController.signal }
    )
      .then(async (response) => {
        const payload = (await response.json()) as { slots?: PraktijkplannerPlanningSlot[]; error?: string };
        if (!response.ok || !payload.slots) {
          throw new Error(payload.error || 'De activiteitenplanning kon niet worden geladen.');
        }
        return payload.slots;
      })
      .then((loaded) => {
        if (!abortController.signal.aborted) setSlots(loaded);
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          setSlotError(error instanceof Error ? error.message : 'De activiteitenplanning kon niet worden geladen.');
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoadingSlots(false);
      });
    return () => abortController.abort();
  }, [end, groupId, weekStart]);

  useEffect(() => loadSlots(), [loadSlots]);

  const loadSeries = useCallback(() => {
    if (!data.isManager) return;
    const participant = selectedParticipantId ? `&iddeelnemer=${selectedParticipantId}` : '';
    fetch(`/api/praktijkplanner/activiteiten/herhaling?idwaarneemgroep=${groupId}${participant}`, {
      credentials: 'include',
    })
      .then(async (response) => {
        const payload = (await response.json()) as { series?: RecurrenceSeries[] };
        if (response.ok && payload.series) setSeries(payload.series);
      })
      .catch(() => undefined);
  }, [data.isManager, groupId, selectedParticipantId]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadSeries(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSeries]);

  useEffect(() => {
    if (pending.size === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending.size]);

  const baseSlotMap = useMemo(
    () => new Map(slots.map((slot) => [slotKey(slot.iddeelnemer, slot.datum, slot.iddagdeel), slot])),
    [slots]
  );

  const selectedSpecifications = useMemo(
    () =>
      data.masterData.specifications.filter(
        (specification) => specification.idactiviteit === selectedActivityId
      ),
    [data.masterData.specifications, selectedActivityId]
  );

  const renderSlot = useCallback(
    (iddeelnemer: number, datum: string, iddagdeel: number) => {
      const key = slotKey(iddeelnemer, datum, iddagdeel);
      const override = pending.get(key);
      const existing = baseSlotMap.get(key);
      const activity =
        override?.idactiviteit != null
          ? data.masterData.activities.find((item) => item.id === override.idactiviteit)
          : override
            ? null
            : existing?.activity;
      const specification =
        override?.idactiviteitspecificatie != null
          ? data.masterData.specifications.find((item) => item.id === override.idactiviteitspecificatie)
          : override
            ? null
            : existing?.specification;
      const location =
        override?.idplannerlocatie != null
          ? data.masterData.locations.find((item) => item.id === override.idplannerlocatie)
          : override
            ? null
            : existing?.location;
      const taskIds = override ? override.taskIds : existing?.tasks.map((task) => task.id) ?? [];
      const tasks = taskIds
        .map((id) => data.masterData.tasks.find((task) => task.id === id))
        .filter(Boolean);
      const availability =
        override?.idbeschikbaarheidstype != null
          ? data.masterData.availabilityTypes.find(
              (availabilityType) => availabilityType.id === override.idbeschikbaarheidstype
            )
          : override
            ? null
            : existing?.availability;

      if (!activity && !location && tasks.length === 0 && !availability) {
        return <span className="block min-h-4" />;
      }
      return (
        <div className="space-y-0.5 text-[10px] leading-tight">
          {activity ? (
            <span
              className="block truncate rounded px-1 py-0.5 font-semibold text-white"
              style={{ backgroundColor: activity.kleur || '#64748b' }}
            >
              {activity.afkorting || activity.naam}
              {specification ? ` · ${specification.afkorting || specification.naam}` : ''}
            </span>
          ) : null}
          {tasks.length > 0 ? (
            <span className="block truncate text-muted-foreground">
              {tasks.map((task) => task?.afkorting || task?.omschrijving).filter(Boolean).join(' · ')}
            </span>
          ) : null}
          {location ? <span className="block truncate text-muted-foreground">{location.afkorting || location.naam}</span> : null}
          {availability ? <span className="block truncate font-medium text-emerald-700">{availability.naam}</span> : null}
          {existing?.recurrenceId ? <span className="text-muted-foreground">↻</span> : null}
        </div>
      );
    },
    [baseSlotMap, data.masterData, pending]
  );

  const queueCell = useCallback(
    ({
      participant,
      datum,
      daypart,
    }: {
      participant: { id: number };
      datum: string;
      daypart: { id: number };
    }) => {
      if (!data.isManager) {
        toast.info('Alleen secretarissen en beheerders kunnen de activiteitenplanning aanpassen.');
        return;
      }
      const key = slotKey(participant.id, datum, daypart.id);
      const pendingSlot = pending.get(key);
      const existingSlot = baseSlotMap.get(key);
      const current = pendingSlot ?? existingSlot;
      if (
        !clearMode &&
        selectedActivityId == null &&
        selectedLocationId == null &&
        selectedAvailabilityId == null &&
        selectedTaskIds.length === 0
      ) {
        toast.info('Kies eerst een activiteit, locatie, beschikbaarheidstype of taak.');
        return;
      }

      const next: PendingSlot = clearMode
        ? {
            iddeelnemer: participant.id,
            datum,
            iddagdeel: daypart.id,
            idactiviteit: null,
            idactiviteitspecificatie: null,
            idplannerlocatie: null,
            idbeschikbaarheidstype: null,
            taskIds: [],
            version: current?.version ?? null,
          }
        : {
            iddeelnemer: participant.id,
            datum,
            iddagdeel: daypart.id,
            idactiviteit: selectedActivityId ?? current?.idactiviteit ?? null,
            idactiviteitspecificatie:
              selectedActivityId != null
                ? selectedSpecificationId
                : current?.idactiviteitspecificatie ?? null,
            idplannerlocatie: selectedLocationId ?? current?.idplannerlocatie ?? null,
            idbeschikbaarheidstype:
              selectedAvailabilityId ??
              pendingSlot?.idbeschikbaarheidstype ??
              existingSlot?.availability?.id ??
              null,
            taskIds:
              selectedTaskIds.length > 0
                ? selectedTaskIds
                : pendingSlot?.taskIds ?? existingSlot?.tasks.map((task) => task.id) ?? [],
            version: current?.version ?? null,
          };
      setPending((previous) => new Map(previous).set(key, next));
    },
    [
      baseSlotMap,
      clearMode,
      data.isManager,
      pending,
      selectedActivityId,
      selectedAvailabilityId,
      selectedLocationId,
      selectedSpecificationId,
      selectedTaskIds,
    ]
  );

  const savePending = useCallback(async () => {
    if (pending.size === 0) return;
    setSaving(true);
    try {
      const response = await fetch('/api/praktijkplanner/activiteiten', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idwaarneemgroep: groupId, slots: [...pending.values()] }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Opslaan mislukt.');
      setPending(new Map());
      loadSlots();
      toast.success('Activiteitenplanning opgeslagen.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  }, [groupId, loadSlots, pending]);

  const runRecurrenceAction = useCallback(
    async (action: 'copyWeek' | 'create') => {
      if (!selectedParticipantId) return;
      try {
        const response = await fetch('/api/praktijkplanner/activiteiten/herhaling', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            idwaarneemgroep: groupId,
            iddeelnemer: selectedParticipantId,
            bronStartdatum: weekStart,
            doelStartdatum: copyTargetDate,
            startdatum: copyTargetDate,
            einddatum: action === 'create' ? repeatEndDate : copyTargetDate,
            frequentieWeken: Number(frequencyWeeks),
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Actie mislukt.');
        toast.success(action === 'copyWeek' ? 'Week gekopieerd.' : 'Herhaling aangemaakt.');
        loadSlots();
        loadSeries();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Actie mislukt.');
      }
    },
    [copyTargetDate, frequencyWeeks, groupId, loadSeries, loadSlots, repeatEndDate, selectedParticipantId, weekStart]
  );

  const updateSeries = useCallback(async () => {
    if (!editingSeries) return;
    try {
      const response = await fetch('/api/praktijkplanner/activiteiten/herhaling', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          idwaarneemgroep: groupId,
          idherhaling: editingSeries.id,
          startdatum: editingSeries.startdatum,
          einddatum: editingSeries.einddatum,
          frequentieWeken: editingSeries.frequentieWeken,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Herhaling bijwerken mislukt.');
      toast.success('Herhaling bijgewerkt.');
      setEditingSeries(null);
      loadSeries();
      loadSlots();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Herhaling bijwerken mislukt.');
    }
  }, [editingSeries, groupId, loadSeries, loadSlots]);

  const deleteSeries = useCallback(
    async (idherhaling: number) => {
      if (!window.confirm('Deze herhaling en de gekoppelde planning verwijderen?')) return;
      try {
        const response = await fetch('/api/praktijkplanner/activiteiten/herhaling', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            idwaarneemgroep: groupId,
            idherhaling,
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Herhaling verwijderen mislukt.');
        toast.success('Herhaling verwijderd.');
        loadSeries();
        loadSlots();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Herhaling verwijderen mislukt.');
      }
    },
    [groupId, loadSeries, loadSlots]
  );

  const sendScheduleEmail = useCallback(async () => {
    if (!selectedParticipantId) return;
    try {
      const response = await fetch('/api/praktijkplanner/email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          iddeelnemer: selectedParticipantId,
          plannerType: 'activiteiten',
          start: weekStart,
          end,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'E-mail versturen mislukt.');
      toast.success('Planning per e-mail verstuurd.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'E-mail versturen mislukt.');
    }
  }, [end, groupId, selectedParticipantId, weekStart]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={showDay} onCheckedChange={(value) => updateVisibility(!!value, showNight)} />
            <Label className="cursor-pointer">Dag</Label>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={showNight} onCheckedChange={(value) => updateVisibility(showDay, !!value)} />
            <Label className="cursor-pointer">Nacht</Label>
          </label>
        </div>
        <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm">
          <span className="font-medium">Zoom</span>
          <select value={zoom} onChange={(event) => setZoom(event.target.value)} className="bg-transparent text-sm">
            <option value="85">85%</option>
            <option value="100">100%</option>
            <option value="115">115%</option>
          </select>
        </label>
      </div>

      {data.isManager ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(14rem,1fr)_auto]">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-sm">
            <label className="text-sm font-medium" htmlFor="planner-participant">
              Deelnemer
            </label>
            <select
              id="planner-participant"
              value={selectedParticipantId ?? ''}
              onChange={(event) => setSelectedParticipantId(Number(event.target.value) || null)}
              className="h-9 min-w-48 rounded-md border bg-background px-2 text-sm"
            >
              {data.participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {[participant.voornaam, participant.achternaam].filter(Boolean).join(' ') ||
                    participant.name ||
                    participant.initialen}
                </option>
              ))}
            </select>
            <label className="text-sm font-medium" htmlFor="participant-filter">
              Toon
            </label>
            <select
              id="participant-filter"
              value={participantFilter}
              onChange={(event) =>
                setParticipantFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))
              }
              className="h-9 min-w-40 rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">Alle deelnemers</option>
              {data.participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {[participant.voornaam, participant.achternaam].filter(Boolean).join(' ') ||
                    participant.name ||
                    participant.initialen}
                </option>
              ))}
            </select>
            <label className="text-sm font-medium" htmlFor="copy-target">
              Doelweek
            </label>
            <input
              id="copy-target"
              type="date"
              value={copyTargetDate}
              onChange={(event) => setCopyTargetDate(event.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            />
            <button type="button" className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted" onClick={() => runRecurrenceAction('copyWeek')}>
              <Copy className="size-4" /> Kopieer week
            </button>
            <input
              type="date"
              aria-label="Herhalen tot"
              value={repeatEndDate}
              onChange={(event) => setRepeatEndDate(event.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            />
            <select
              aria-label="Herhalingsfrequentie"
              value={frequencyWeeks}
              onChange={(event) => setFrequencyWeeks(event.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="1">Elke week</option>
              <option value="2">Om de week</option>
              <option value="3">Elke 3 weken</option>
            </select>
            <button type="button" className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted" onClick={() => runRecurrenceAction('create')}>
              <Repeat2 className="size-4" /> Herhaal
            </button>
            <button type="button" className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted" onClick={sendScheduleEmail}>
              <Mail className="size-4" /> E-mail
            </button>
          </div>
        </div>
      ) : null}

      {data.isManager ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <PlannerChipPalette
            title="Activiteiten"
            items={data.masterData.activities.map((activity) => ({
              id: activity.id,
              label: activity.afkorting || activity.naam,
              detail: activity.naam,
              color: activity.kleur,
            }))}
            selectedId={selectedActivityId}
            onSelect={(id) => {
              setClearMode(false);
              setSelectedActivityId(Number(id));
            }}
            onClear={() => setSelectedActivityId(null)}
          />
          <PlannerChipPalette
            title="Specificaties"
            items={selectedSpecifications.map((specification) => ({
              id: specification.id,
              label: specification.afkorting || specification.naam,
              color: specification.kleur,
            }))}
            selectedId={selectedSpecificationId}
            onSelect={(id) => {
              setClearMode(false);
              setSelectedSpecificationId(Number(id));
            }}
            onClear={() => setSelectedSpecificationId(null)}
            emptyMessage="Kies eerst een activiteit met specificaties."
          />
          <PlannerChipPalette
            title="Locaties"
            items={data.masterData.locations.map((location) => ({
              id: location.id,
              label: location.afkorting || location.naam,
              detail: location.naam,
              color: location.kleur,
            }))}
            selectedId={selectedLocationId}
            onSelect={(id) => {
              setClearMode(false);
              setSelectedLocationId(Number(id));
            }}
            onClear={() => setSelectedLocationId(null)}
          />
          <PlannerChipPalette
            title="Beschikbaarheid"
            items={data.masterData.availabilityTypes.map((availability) => ({
              id: availability.id,
              label: availability.naam,
              color: availability.kleur,
            }))}
            selectedId={selectedAvailabilityId}
            onSelect={(id) => {
              setClearMode(false);
              setSelectedAvailabilityId(Number(id));
            }}
            onClear={() => setSelectedAvailabilityId(null)}
          />
          <section className="rounded-xl border bg-card p-3 shadow-sm xl:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Taken (maximaal 3)</h2>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedTaskIds([])}>
                Wis selectie
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.masterData.tasks.map((task) => {
                const checked = selectedTaskIds.includes(task.id);
                return (
                  <label key={task.id} className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => {
                        setClearMode(false);
                        setSelectedTaskIds((current) => {
                          if (value) return current.length < 3 ? [...current, task.id] : current;
                          return current.filter((id) => id !== task.id);
                        });
                      }}
                    />
                    {task.afkorting || task.omschrijving}
                  </label>
                );
              })}
            </div>
          </section>
          <button
            type="button"
            className={[
              'inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium',
              clearMode ? 'border-destructive bg-destructive text-destructive-foreground' : 'hover:bg-muted',
            ].join(' ')}
            onClick={() => setClearMode((value) => !value)}
          >
            <Trash2 className="size-4" />
            {clearMode ? 'Verwijdermodus actief' : 'Cel leegmaken'}
          </button>
        </div>
      ) : null}

      {slotError ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{slotError}</p> : null}
      {loadingSlots ? <p className="text-sm text-muted-foreground">Planning laden…</p> : null}
      <PlannerDaypartGrid
        participants={visibleParticipants}
        dayparts={visibleDayparts}
        weekStart={weekStart}
        onWeekStartChange={setWeekStart}
        zoom={zoom}
        renderCell={({ participant, datum, daypart }) => renderSlot(participant.id, datum, daypart.id)}
        onCellClick={queueCell}
        isCellDisabled={() => !data.isManager}
        holidayLabels={holidays}
      />

      {data.isManager && series.length > 0 ? (
        <section className="rounded-xl border bg-card p-3 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Actieve herhalingen</h2>
          <div className="space-y-2">
            {series.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                <span>
                  {item.startdatum} t/m {item.einddatum} · elke {item.frequentieWeken} week
                  {item.frequentieWeken === 1 ? '' : 'en'}
                </span>
                <span className="flex gap-2">
                  <button type="button" className="rounded border px-2 py-1 hover:bg-muted" onClick={() => setEditingSeries(item)}>
                    Bewerken
                  </button>
                  <button type="button" className="rounded border border-destructive/40 px-2 py-1 text-destructive hover:bg-destructive/10" onClick={() => deleteSeries(item.id)}>
                    Verwijderen
                  </button>
                </span>
              </div>
            ))}
          </div>
          {editingSeries ? (
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-muted/50 p-3">
              <label className="grid gap-1 text-xs">
                Start
                <input type="date" value={editingSeries.startdatum} onChange={(event) => setEditingSeries({ ...editingSeries, startdatum: event.target.value })} className="h-8 rounded border bg-background px-2" />
              </label>
              <label className="grid gap-1 text-xs">
                Einde
                <input type="date" value={editingSeries.einddatum} onChange={(event) => setEditingSeries({ ...editingSeries, einddatum: event.target.value })} className="h-8 rounded border bg-background px-2" />
              </label>
              <label className="grid gap-1 text-xs">
                Frequentie
                <select value={editingSeries.frequentieWeken} onChange={(event) => setEditingSeries({ ...editingSeries, frequentieWeken: Number(event.target.value) })} className="h-8 rounded border bg-background px-2">
                  <option value={1}>Elke week</option>
                  <option value={2}>Om de week</option>
                  <option value={3}>Elke 3 weken</option>
                </select>
              </label>
              <button type="button" className="rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground" onClick={updateSeries}>
                Bijwerken
              </button>
              <button type="button" className="rounded border px-3 py-2 text-xs hover:bg-muted" onClick={() => setEditingSeries(null)}>
                Annuleren
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {data.isManager && pending.size > 0 ? (
        <div className="sticky bottom-4 flex items-center justify-between rounded-xl border bg-card p-3 shadow-lg">
          <p className="text-sm text-muted-foreground">{pending.size} niet-opgeslagen wijziging(en)</p>
          <div className="flex gap-2">
            <button type="button" className="rounded-md border px-3 py-2 text-sm hover:bg-muted" onClick={() => setPending(new Map())}>
              Wijzigingen verwerpen
            </button>
            <button
              type="button"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              onClick={savePending}
            >
              <Save className="size-4" />
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ActiviteitenPlannerPage() {
  return (
    <>
      <Head>
        <title>Activiteiten planner | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage
        title="Activiteiten planner"
        description="Plan activiteiten, taken, locaties en beschikbaarheid per deelnemer en dagdeel."
      >
        {(context) => <ActivitiesContent {...context} />}
      </PraktijkplannerPage>
    </>
  );
}
