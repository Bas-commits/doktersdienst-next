'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Repeat, SendHorizontal, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { PlannerActivityAssignmentBuilder } from '@/components/praktijkplanner/PlannerActivityAssignmentBuilder';
import {
  PlannerCombinedDaypartChip,
  type PlannerDaypartChipItem,
} from '@/components/praktijkplanner/PlannerCombinedDaypartChip';
import type { PlannerCursorTool } from '@/components/praktijkplanner/PlannerCursorTool';
import { PlannerCopyWeekModal } from '@/components/praktijkplanner/PlannerCopyWeekModal';
import { PlannerDaypartGrid } from '@/components/praktijkplanner/PlannerDaypartGrid';
import { PlannerDaypartHoverPreview } from '@/components/praktijkplanner/PlannerDaypartHoverPreview';
import { PlannerNotifyPlanningModal } from '@/components/praktijkplanner/PlannerNotifyPlanningModal';
import { PlannerRepeatWeekModal } from '@/components/praktijkplanner/PlannerRepeatWeekModal';
import { PraktijkplannerPage, type PraktijkplannerPageContext } from '@/components/praktijkplanner/PraktijkplannerPage';
import { plannerWeekGridNavOffsetPx } from '@/components/praktijkplanner/planner-grid-layout';
import { usePlannerHolidays } from '@/hooks/praktijkplanner/usePlannerHolidays';
import {
  buildActivityAssignmentSlot,
  hasActivityAssignmentSelection,
  type ActivityAssignmentSelection,
  type CurrentActivityAssignment,
} from '@/lib/praktijkplanner/activity-assignment';
import { activiteitenIconPath } from '@/lib/praktijkplanner/activiteiten-iconen';
import { deelnemerChipInitials } from '@/lib/deelnemer-display';
import { addDays, formatIsoDate, startOfIsoWeek } from '@/lib/praktijkplanner/dates';
import type { PraktijkplannerParticipant, PraktijkplannerPlanningSlot } from '@/types/praktijkplanner';

type RecurrenceSeries = {
  id: number;
  iddeelnemer: number;
  startdatum: string;
  einddatum: string;
  frequentieWeken: number;
};

type ParticipantActionModal =
  | { type: 'copy'; participant: PraktijkplannerParticipant; sourceWeekStart: string }
  | { type: 'repeat'; participant: PraktijkplannerParticipant; sourceWeekStart: string }
  | { type: 'email'; participant: PraktijkplannerParticipant };

function participantDisplayName(participant: PraktijkplannerParticipant): string {
  return (
    [participant.voornaam, participant.achternaam].filter(Boolean).join(' ') ||
    participant.name ||
    participant.initialen ||
    `Deelnemer ${participant.id}`
  );
}

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
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [selectedSpecificationId, setSelectedSpecificationId] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<number | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [clearMode, setClearMode] = useState(false);
  const [showDay, setShowDay] = useState(true);
  const [showNight, setShowNight] = useState(true);
  const [participantFilter, setParticipantFilter] = useState<number | 'all'>('all');
  const [zoom, setZoom] = useState('100');
  const [series, setSeries] = useState<RecurrenceSeries[]>([]);
  const [editingSeries, setEditingSeries] = useState<RecurrenceSeries | null>(null);
  const [actionModal, setActionModal] = useState<ParticipantActionModal | null>(null);

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

  const refreshSlots = useCallback(async () => {
    const response = await fetch(
      `/api/praktijkplanner/activiteiten?idwaarneemgroep=${groupId}&start=${weekStart}&end=${end}`,
      { credentials: 'include' }
    );
    const payload = (await response.json()) as { slots?: PraktijkplannerPlanningSlot[]; error?: string };
    if (!response.ok || !payload.slots) {
      throw new Error(payload.error || 'De activiteitenplanning kon niet worden geladen.');
    }
    setSlots(payload.slots);
  }, [end, groupId, weekStart]);

  useEffect(() => loadSlots(), [loadSlots]);

  const loadSeries = useCallback(() => {
    if (!data.isManager) return;
    fetch(`/api/praktijkplanner/activiteiten/herhaling?idwaarneemgroep=${groupId}`, {
      credentials: 'include',
    })
      .then(async (response) => {
        const payload = (await response.json()) as { series?: RecurrenceSeries[] };
        if (response.ok && payload.series) setSeries(payload.series);
      })
      .catch(() => undefined);
  }, [data.isManager, groupId]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadSeries(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSeries]);

  const baseSlotMap = useMemo(
    () => new Map(slots.map((slot) => [slotKey(slot.iddeelnemer, slot.datum, slot.iddagdeel), slot])),
    [slots]
  );

  const renderSlot = useCallback(
    ({
      participant,
      datum,
      daypart,
      hoverEnabled,
    }: {
      participant: PraktijkplannerParticipant;
      datum: string;
      daypart: { id: number; naam: string };
      hoverEnabled: boolean;
    }) => {
      const key = slotKey(participant.id, datum, daypart.id);
      const existing = baseSlotMap.get(key);
      const activity = existing?.activity ?? null;
      const specification = existing?.specification ?? null;
      const location = existing?.location ?? null;
      const tasks = existing?.tasks ?? [];
      const availability = existing?.availability ?? null;
      const initials = deelnemerChipInitials(participant);
      const participantName = participantDisplayName(participant);

      if (!activity && !location && tasks.length === 0 && !availability) {
        return null;
      }

      const taskItems: PlannerDaypartChipItem[] = tasks.flatMap((task) =>
        task
          ? [
              {
                id: task.id,
                label: task.afkorting || task.omschrijving || `Taak ${task.id}`,
                color: task.kleur,
              },
            ]
          : []
      );
      const activityItem: PlannerDaypartChipItem | null = activity
        ? {
            id: activity.id,
            label: [
              activity.afkorting || activity.naam,
              specification ? specification.afkorting || specification.naam : null,
            ]
              .filter(Boolean)
              .join(' · '),
            color: specification?.kleur || activity.kleur,
            icon: activiteitenIconPath(activity.icon),
          }
        : null;
      const locationItem: PlannerDaypartChipItem | null = location
        ? {
            id: location.id,
            label: location.afkorting || location.naam,
            color: location.kleur,
          }
        : null;

      const chip = (
        <div className="relative h-full w-full min-w-0">
          {activityItem || locationItem || taskItems.length > 0 ? (
            <PlannerCombinedDaypartChip
              tasks={taskItems}
              activity={activityItem}
              location={locationItem}
              fill
              participantColor={participant.color}
              initials={initials}
              className="shadow-none"
            />
          ) : null}
          {availability ? (
            <span className="pointer-events-none absolute inset-x-0.5 bottom-0.5 truncate rounded bg-background/80 px-0.5 text-[9px] font-medium text-emerald-700">
              {availability.naam}
            </span>
          ) : null}
          {existing?.isUitzondering ? (
            <span
              className="pointer-events-none absolute top-0.5 left-0.5 z-20 rounded bg-background/90 p-0.5 text-amber-500"
              title="Uitzondering op herhaling"
            >
              <TriangleAlert className="size-3.5" aria-hidden />
            </span>
          ) : null}
        </div>
      );

      return (
        <PlannerDaypartHoverPreview
          enabled={hoverEnabled}
          participantName={participantName}
          initials={initials}
          datum={datum}
          daypartName={daypart.naam}
          fromRepetition={existing?.recurrenceId != null}
          isException={Boolean(existing?.isUitzondering)}
          availabilityName={availability?.naam}
          chip={
            <PlannerCombinedDaypartChip
              tasks={taskItems}
              activity={activityItem}
              location={locationItem}
              fill
              participantColor={participant.color}
              initials={initials}
              initialsVariant="popover"
              className="shadow-sm"
            />
          }
        >
          {chip}
        </PlannerDaypartHoverPreview>
      );
    },
    [baseSlotMap]
  );

  const isCellFilled = useCallback(
    ({
      participant,
      datum,
      daypart,
    }: {
      participant: { id: number };
      datum: string;
      daypart: { id: number };
    }) => {
      const key = slotKey(participant.id, datum, daypart.id);
      const existing = baseSlotMap.get(key);
      return Boolean(
        existing?.activity ||
          existing?.location ||
          existing?.availability ||
          existing?.tasks.length
      );
    },
    [baseSlotMap]
  );

  const getCellClassName = useCallback(
    ({
      participant,
      datum,
      daypart,
    }: {
      participant: { id: number };
      datum: string;
      daypart: { id: number };
    }) => {
      const existing = baseSlotMap.get(slotKey(participant.id, datum, daypart.id));
      if (!existing?.isUitzondering) return undefined;
      return 'border-2 border-amber-400 bg-amber-100 enabled:hover:border-amber-500 enabled:hover:bg-amber-100';
    },
    [baseSlotMap]
  );

  const clearSelection = useCallback(() => {
    setClearMode(false);
    setSelectedActivityId(null);
    setSelectedSpecificationId(null);
    setSelectedLocationId(null);
    setSelectedAvailabilityId(null);
    setSelectedTaskIds([]);
  }, []);

  const setAssignmentClearMode = useCallback((enabled: boolean) => {
    setClearMode(enabled);
    if (!enabled) return;
    setSelectedActivityId(null);
    setSelectedSpecificationId(null);
    setSelectedLocationId(null);
    setSelectedAvailabilityId(null);
    setSelectedTaskIds([]);
  }, []);

  const dismissCursorTool = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const cursorTool = useMemo((): PlannerCursorTool | null => {
    if (!data.isManager) return null;
    if (clearMode) {
      return {
        icon: <Trash2 className="text-white" aria-hidden />,
        color: '#c91b23',
        label: 'Leegmaken',
      };
    }

    const activity = data.masterData.activities.find((item) => item.id === selectedActivityId);
    const specification = data.masterData.specifications.find(
      (item) => item.id === selectedSpecificationId
    );
    const location = data.masterData.locations.find((item) => item.id === selectedLocationId);
    const availability = data.masterData.availabilityTypes.find(
      (item) => item.id === selectedAvailabilityId
    );
    const tasks = selectedTaskIds.flatMap(
      (id) => data.masterData.tasks.find((task) => task.id === id) ?? []
    );
    if (!activity && !location && !availability && tasks.length === 0) return null;

    const labels = [
      activity
        ? [
            activity.afkorting || activity.naam,
            specification ? specification.afkorting || specification.naam : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : null,
      ...tasks.map((task) => task.afkorting || task.omschrijving),
      location ? location.afkorting || location.naam : null,
      availability ? availability.code || availability.naam : null,
    ].filter(Boolean);
    const icon =
      activiteitenIconPath(activity?.icon) ??
      activiteitenIconPath(availability?.icon) ??
      null;

    return {
      icon,
      color:
        activity?.kleur ??
        availability?.kleur ??
        location?.kleur ??
        tasks[0]?.kleur ??
        '#64748b',
      label: labels.join(' · '),
      preview:
        activity || location || tasks.length > 0 ? (
          <PlannerCombinedDaypartChip
            tasks={tasks.map((task) => ({
              id: task.id,
              label: task.afkorting || task.omschrijving || `Taak ${task.id}`,
              color: task.kleur,
            }))}
            activity={
              activity
                ? {
                    id: activity.id,
                    label: [
                      activity.afkorting || activity.naam,
                      specification ? specification.afkorting || specification.naam : null,
                    ]
                      .filter(Boolean)
                      .join(' · '),
                    color: specification?.kleur || activity.kleur,
                    icon: activiteitenIconPath(activity.icon),
                  }
                : null
            }
            location={
              location
                ? {
                    id: location.id,
                    label: location.afkorting || location.naam,
                    color: location.kleur,
                  }
                : null
            }
            className="w-28 ring-2 ring-white/80"
          />
        ) : undefined,
    };
  }, [
    clearMode,
    data.isManager,
    data.masterData.activities,
    data.masterData.availabilityTypes,
    data.masterData.locations,
    data.masterData.specifications,
    data.masterData.tasks,
    selectedActivityId,
    selectedAvailabilityId,
    selectedLocationId,
    selectedSpecificationId,
    selectedTaskIds,
  ]);

  const queueCell = useCallback(
    async ({
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
      const existingSlot = baseSlotMap.get(key);
      const currentAssignment: CurrentActivityAssignment | null = existingSlot
        ? {
            idactiviteit: existingSlot.idactiviteit,
            idactiviteitspecificatie: existingSlot.idactiviteitspecificatie,
            idplannerlocatie: existingSlot.idplannerlocatie,
            idbeschikbaarheidstype: existingSlot.availability?.id ?? null,
            taskIds: existingSlot.tasks.map((task) => task.id),
            version: existingSlot.version,
          }
        : null;
      const selection: ActivityAssignmentSelection = {
        activityId: selectedActivityId,
        specificationId: selectedSpecificationId,
        taskIds: selectedTaskIds,
        locationId: selectedLocationId,
        availabilityId: selectedAvailabilityId,
      };

      if (!clearMode && !hasActivityAssignmentSelection(selection)) {
        toast.info('Kies eerst een activiteit, locatie, beschikbaarheidstype of taak.');
        return;
      }

      const next = buildActivityAssignmentSlot({
        participantId: participant.id,
        date: datum,
        daypartId: daypart.id,
        selection,
        current: currentAssignment,
        clearMode,
      });

      const activity =
        next.idactiviteit != null
          ? data.masterData.activities.find((item) => item.id === next.idactiviteit) ?? null
          : null;
      const specification =
        next.idactiviteitspecificatie != null
          ? data.masterData.specifications.find((item) => item.id === next.idactiviteitspecificatie) ?? null
          : null;
      const location =
        next.idplannerlocatie != null
          ? data.masterData.locations.find((item) => item.id === next.idplannerlocatie) ?? null
          : null;
      const tasks = next.taskIds.flatMap(
        (id, index) => {
          const task = data.masterData.tasks.find((item) => item.id === id);
          return task
            ? [
                {
                  id: task.id,
                  positie: index,
                  afkorting: task.afkorting,
                  omschrijving: task.omschrijving,
                  kleur: task.kleur,
                },
              ]
            : [];
        }
      );
      const availability =
        next.idbeschikbaarheidstype != null
          ? data.masterData.availabilityTypes.find(
              (item) => item.id === next.idbeschikbaarheidstype
            ) ?? null
          : null;
      const hasAssignment = activity != null || location != null || tasks.length > 0 || availability != null;
      const previousSlots = slots;

      setSlots((current) => {
        const updated = current.filter(
          (slot) => slotKey(slot.iddeelnemer, slot.datum, slot.iddagdeel) !== key
        );
        if (!hasAssignment) return updated;

        updated.push({
          id: existingSlot?.id ?? -1,
          iddeelnemer: participant.id,
          datum,
          iddagdeel: daypart.id,
          idactiviteit: next.idactiviteit,
          idactiviteitspecificatie: next.idactiviteitspecificatie,
          idplannerlocatie: next.idplannerlocatie,
          version: existingSlot?.version ?? 0,
          activity,
          specification,
          location,
          tasks,
          availability,
          recurrenceId: existingSlot?.recurrenceId ?? null,
          isBronslot: existingSlot?.isBronslot ?? null,
          isUitzondering:
            existingSlot?.recurrenceId != null && existingSlot.isBronslot === false
              ? true
              : (existingSlot?.isUitzondering ?? null),
        });
        return updated;
      });

      try {
        const response = await fetch('/api/praktijkplanner/activiteiten', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idwaarneemgroep: groupId, slots: [next] }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Wijziging kon niet worden opgeslagen.');
        await refreshSlots();
        toast.success(clearMode ? 'Dagdeel leeggemaakt.' : 'Dagdeel opgeslagen.');
      } catch (error) {
        setSlots(previousSlots);
        toast.error(error instanceof Error ? error.message : 'Wijziging kon niet worden opgeslagen.');
      }
    },
    [
      baseSlotMap,
      clearMode,
      data.isManager,
      data.masterData.activities,
      data.masterData.availabilityTypes,
      data.masterData.locations,
      data.masterData.specifications,
      data.masterData.tasks,
      groupId,
      refreshSlots,
      selectedActivityId,
      selectedAvailabilityId,
      selectedLocationId,
      selectedSpecificationId,
      selectedTaskIds,
      slots,
    ]
  );

  const refreshAfterRecurrence = useCallback(() => {
    loadSlots();
    loadSeries();
  }, [loadSeries, loadSlots]);

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
      const keepPlanning = window.confirm(
        'Herhalingspatroon verwijderen?\n\nOK = patroon verwijderen, planning behouden\nAnnuleren = niets doen'
      );
      if (!keepPlanning) return;
      const alsoDeletePlanning = window.confirm(
        'Wilt u de gekoppelde planning ook verwijderen?\n\nOK = ook planning verwijderen\nAnnuleren = alleen patroon verwijderen'
      );
      try {
        const response = await fetch('/api/praktijkplanner/activiteiten/herhaling', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            idwaarneemgroep: groupId,
            idherhaling,
            mode: alsoDeletePlanning ? 'deletePlanning' : 'unlink',
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Herhaling verwijderen mislukt.');
        toast.success(
          alsoDeletePlanning
            ? 'Herhaling en planning verwijderd.'
            : 'Herhalingspatroon verwijderd; planning behouden.'
        );
        loadSeries();
        loadSlots();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Herhaling verwijderen mislukt.');
      }
    },
    [groupId, loadSeries, loadSlots]
  );

  const renderParticipantActions = useCallback(
    (participant: PraktijkplannerParticipant) => (
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Week kopiëren"
          title="Week kopiëren"
          onClick={() =>
            setActionModal({ type: 'copy', participant, sourceWeekStart: weekStart })
          }
        >
          <Copy className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Herhalen"
          title="Herhalen"
          onClick={() =>
            setActionModal({ type: 'repeat', participant, sourceWeekStart: weekStart })
          }
        >
          <Repeat className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Planning per e-mail versturen"
          title="Planning per e-mail versturen"
          onClick={() => setActionModal({ type: 'email', participant })}
        >
          <SendHorizontal className="size-3.5" aria-hidden />
        </button>
      </div>
    ),
    [weekStart]
  );

  return (
    <div className="space-y-4">
      

      

      <div className="flex items-start gap-4">
        {data.isManager ? (
          <div className="shrink-0 self-stretch">
            <div
              className="sticky top-4"
              style={{ marginTop: `${plannerWeekGridNavOffsetPx()}px` }}
              data-planner-tool-keep-active
            >
              <PlannerActivityAssignmentBuilder
                activities={data.masterData.activities}
                specifications={data.masterData.specifications}
                tasks={data.masterData.tasks}
                locations={data.masterData.locations}
                availabilityTypes={data.masterData.availabilityTypes}
                selection={{
                  activityId: selectedActivityId,
                  specificationId: selectedSpecificationId,
                  taskIds: selectedTaskIds,
                  locationId: selectedLocationId,
                  availabilityId: selectedAvailabilityId,
                }}
                clearMode={clearMode}
                onActivityChange={(id) => {
                  setClearMode(false);
                  setSelectedActivityId(id);
                  setSelectedSpecificationId(null);
                }}
                onSpecificationChange={(id) => {
                  setClearMode(false);
                  setSelectedSpecificationId(id);
                }}
                onTaskChange={(ids) => {
                  setClearMode(false);
                  setSelectedTaskIds(ids);
                }}
                onLocationChange={(id) => {
                  setClearMode(false);
                  setSelectedLocationId(id);
                }}
                onAvailabilityChange={(id) => {
                  setClearMode(false);
                  setSelectedAvailabilityId(id);
                }}
                onClearSelection={clearSelection}
                onClearModeChange={setAssignmentClearMode}
              />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-4">
          {slotError ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{slotError}</p> : null}
          {loadingSlots ? <p className="text-sm text-muted-foreground">Planning laden…</p> : null}
          <PlannerDaypartGrid
            participants={visibleParticipants}
            dayparts={visibleDayparts}
            weekStart={weekStart}
            onWeekStartChange={setWeekStart}
            zoom={zoom}
            renderCell={({ participant, datum, daypart }) =>
              renderSlot({
                participant,
                datum,
                daypart,
                hoverEnabled: cursorTool == null,
              })
            }
            onCellClick={queueCell}
            isCellDisabled={() => !data.isManager}
            isCellFilled={isCellFilled}
            getCellClassName={getCellClassName}
            holidayLabels={holidays}
            cursorTool={cursorTool}
            onCursorToolDismiss={dismissCursorTool}
            renderParticipantActions={data.isManager ? renderParticipantActions : undefined}
          />
        </div>
      </div>

      {actionModal?.type === 'copy' ? (
        <PlannerCopyWeekModal
          open
          onClose={() => setActionModal(null)}
          groupId={groupId}
          participant={actionModal.participant}
          sourceWeekStart={actionModal.sourceWeekStart}
          dayparts={visibleDayparts}
          onCopied={refreshAfterRecurrence}
        />
      ) : null}
      {actionModal?.type === 'repeat' ? (
        <PlannerRepeatWeekModal
          open
          onClose={() => setActionModal(null)}
          groupId={groupId}
          participantId={actionModal.participant.id}
          participantName={participantDisplayName(actionModal.participant)}
          sourceWeekStart={actionModal.sourceWeekStart}
          onCreated={refreshAfterRecurrence}
        />
      ) : null}
      {actionModal?.type === 'email' ? (
        <PlannerNotifyPlanningModal
          open
          onClose={() => setActionModal(null)}
          groupId={groupId}
          participantId={actionModal.participant.id}
          participantName={participantDisplayName(actionModal.participant)}
        />
      ) : null}

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
