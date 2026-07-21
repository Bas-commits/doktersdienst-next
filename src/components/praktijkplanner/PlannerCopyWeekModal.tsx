'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  PlannerCombinedDaypartChip,
  type PlannerDaypartChipItem,
} from '@/components/praktijkplanner/PlannerCombinedDaypartChip';
import { PlannerDaypartGrid } from '@/components/praktijkplanner/PlannerDaypartGrid';
import { usePlannerHolidays } from '@/hooks/praktijkplanner/usePlannerHolidays';
import { activiteitenIconPath } from '@/lib/praktijkplanner/activiteiten-iconen';
import { addDays, startOfIsoWeek } from '@/lib/praktijkplanner/dates';
import { notifyPlannerChanged } from '@/lib/praktijkplanner/planner-change-broadcast';
import { deelnemerChipInitials } from '@/lib/deelnemer-display';
import type {
  PraktijkplannerDaypart,
  PraktijkplannerParticipant,
  PraktijkplannerPlanningSlot,
} from '@/types/praktijkplanner';

function slotKey(iddeelnemer: number, datum: string, iddagdeel: number) {
  return `${iddeelnemer}:${datum}:${iddagdeel}`;
}

function formatWeekLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const startLabel = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${weekStart}T12:00:00`));
  const endLabel = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${end}T12:00:00`));
  return `${startLabel} – ${endLabel}`;
}

function participantLabel(participant: PraktijkplannerParticipant): string {
  return (
    [participant.voornaam, participant.achternaam].filter(Boolean).join(' ') ||
    participant.name ||
    participant.initialen ||
    `Deelnemer ${participant.id}`
  );
}

export function PlannerCopyWeekModal({
  open,
  onClose,
  groupId,
  participant,
  sourceWeekStart,
  dayparts,
  onCopied,
  initialTargetWeekStart,
}: {
  open: boolean;
  onClose: () => void;
  groupId: number;
  participant: PraktijkplannerParticipant;
  sourceWeekStart: string;
  dayparts: PraktijkplannerDaypart[];
  onCopied?: () => void;
  /** Override initial target week (defaults to source + 7). */
  initialTargetWeekStart?: string;
}) {
  const defaultTarget = initialTargetWeekStart ?? addDays(sourceWeekStart, 7);
  const [targetWeekStart, setTargetWeekStart] = useState(defaultTarget);
  const [slots, setSlots] = useState<PraktijkplannerPlanningSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [overwriteConfirm, setOverwriteConfirm] = useState(false);

  const targetEnd = useMemo(() => addDays(targetWeekStart, 6), [targetWeekStart]);
  const holidays = usePlannerHolidays(targetWeekStart, targetEnd);

  useEffect(() => {
    if (!open) return;
    setTargetWeekStart(initialTargetWeekStart ?? addDays(sourceWeekStart, 7));
    setOverwriteConfirm(false);
  }, [initialTargetWeekStart, open, sourceWeekStart]);

  useEffect(() => {
    if (!open) return;
    const abortController = new AbortController();
    setLoading(true);
    fetch(
      `/api/praktijkplanner/activiteiten?idwaarneemgroep=${groupId}&start=${targetWeekStart}&end=${targetEnd}&iddeelnemer=${participant.id}`,
      { credentials: 'include', signal: abortController.signal }
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          slots?: PraktijkplannerPlanningSlot[];
          error?: string;
        };
        if (!response.ok || !payload.slots) {
          throw new Error(payload.error || 'Planning kon niet worden geladen.');
        }
        return payload.slots;
      })
      .then((loaded) => {
        if (!abortController.signal.aborted) setSlots(loaded);
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          setSlots([]);
          toast.error(error instanceof Error ? error.message : 'Planning kon niet worden geladen.');
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false);
      });
    return () => abortController.abort();
  }, [groupId, open, participant.id, targetEnd, targetWeekStart]);

  const slotMap = useMemo(
    () => new Map(slots.map((slot) => [slotKey(slot.iddeelnemer, slot.datum, slot.iddagdeel), slot])),
    [slots]
  );

  const renderCell = useCallback(
    ({
      participant: cellParticipant,
      datum,
      daypart,
    }: {
      participant: PraktijkplannerParticipant;
      datum: string;
      daypart: PraktijkplannerDaypart;
    }) => {
      const existing = slotMap.get(slotKey(cellParticipant.id, datum, daypart.id));
      const activity = existing?.activity ?? null;
      const specification = existing?.specification ?? null;
      const location = existing?.location ?? null;
      const tasks = existing?.tasks ?? [];
      const availability = existing?.availability ?? null;
      if (!activity && !location && tasks.length === 0 && !availability) return null;

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

      return (
        <div className="relative h-full w-full min-w-0">
          {activityItem || locationItem || taskItems.length > 0 ? (
            <PlannerCombinedDaypartChip
              tasks={taskItems}
              activity={activityItem}
              location={locationItem}
              fill
              participantColor={cellParticipant.color}
              initials={deelnemerChipInitials(cellParticipant)}
              className="shadow-none"
            />
          ) : null}
          {availability ? (
            <span className="pointer-events-none absolute inset-x-0.5 bottom-0.5 truncate rounded bg-background/80 px-0.5 text-[9px] font-medium text-emerald-700">
              {availability.naam}
            </span>
          ) : null}
        </div>
      );
    },
    [slotMap]
  );

  const isCellFilled = useCallback(
    ({
      participant: cellParticipant,
      datum,
      daypart,
    }: {
      participant: { id: number };
      datum: string;
      daypart: { id: number };
    }) => {
      const existing = slotMap.get(slotKey(cellParticipant.id, datum, daypart.id));
      return Boolean(
        existing?.activity ||
          existing?.location ||
          existing?.availability ||
          existing?.tasks.length
      );
    },
    [slotMap]
  );

  const targetHasPlanning = useMemo(
    () =>
      slots.some(
        (slot) =>
          Boolean(slot.activity) ||
          Boolean(slot.location) ||
          Boolean(slot.availability) ||
          (slot.tasks?.length ?? 0) > 0
      ),
    [slots]
  );

  const copyToTargetWeek = useCallback(
    async (overwrite: boolean) => {
      if (targetWeekStart === sourceWeekStart) return;
      if (!overwrite && targetHasPlanning) {
        setOverwriteConfirm(true);
        return;
      }
      setCopying(true);
      try {
        const response = await fetch('/api/praktijkplanner/activiteiten/herhaling', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'copyWeek',
            idwaarneemgroep: groupId,
            iddeelnemer: participant.id,
            bronStartdatum: sourceWeekStart,
            doelStartdatum: targetWeekStart,
            startdatum: targetWeekStart,
            einddatum: targetWeekStart,
            frequentieWeken: 1,
            overwrite,
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (response.status === 409 && !overwrite) {
          setOverwriteConfirm(true);
          return;
        }
        if (!response.ok) throw new Error(payload.error || 'Kopiëren mislukt.');
        toast.success(
          overwrite ? 'Week gekopieerd (bestaande planning overschreven).' : 'Week gekopieerd.'
        );
        notifyPlannerChanged(groupId);
        setOverwriteConfirm(false);
        onCopied?.();
        // Reload modal week so chips appear after copy
        const reload = await fetch(
          `/api/praktijkplanner/activiteiten?idwaarneemgroep=${groupId}&start=${targetWeekStart}&end=${targetEnd}&iddeelnemer=${participant.id}`,
          { credentials: 'include' }
        );
        const reloadPayload = (await reload.json()) as { slots?: PraktijkplannerPlanningSlot[] };
        if (reload.ok && reloadPayload.slots) setSlots(reloadPayload.slots);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Kopiëren mislukt.');
      } finally {
        setCopying(false);
      }
    },
    [
      groupId,
      onCopied,
      participant.id,
      sourceWeekStart,
      targetEnd,
      targetHasPlanning,
      targetWeekStart,
    ]
  );

  if (!open) return null;

  const sameWeek = targetWeekStart === sourceWeekStart;

  if (overwriteConfirm) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-overwrite-modal-title"
        onClick={onClose}
        data-testid="copy-overwrite-modal"
      >
        <div
          className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="copy-overwrite-modal-title" className="mb-2 text-lg font-semibold tracking-tight">
            Bestaande planning overschrijven?
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            In de doelweek ({formatWeekLabel(targetWeekStart)}) staat al een planning voor{' '}
            {participantLabel(participant)}. Wilt u deze overschrijven met de gekopieerde week?
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOverwriteConfirm(false)}
              disabled={copying}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              onClick={() => void copyToTargetWeek(true)}
              disabled={copying}
              data-testid="copy-overwrite-confirm"
              className="border-[#c91b23] bg-[#c91b23] text-white hover:bg-[#a8161d] hover:text-white"
            >
              {copying ? 'Bezig…' : 'Overschrijven'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-week-modal-title"
      onClick={onClose}
      data-testid="copy-week-modal"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 id="copy-week-modal-title" className="text-lg font-semibold tracking-tight">
              Week kopiëren — {participantLabel(participant)}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bronweek: {formatWeekLabel(sourceWeekStart)}. Navigeer naar een andere week en
              kopieer de bronplanning daarheen.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Sluiten
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {loading ? <p className="mb-2 text-sm text-muted-foreground">Planning laden…</p> : null}
          <PlannerDaypartGrid
            participants={[participant]}
            dayparts={dayparts}
            weekStart={targetWeekStart}
            onWeekStartChange={(next) => {
              setOverwriteConfirm(false);
              setTargetWeekStart(startOfIsoWeek(next));
            }}
            zoom="85"
            renderCell={renderCell}
            isCellFilled={isCellFilled}
            holidayLabels={holidays}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Doelweek: {formatWeekLabel(targetWeekStart)}
            {sameWeek ? ' (zelfde als bronweek)' : ''}
          </p>
          <Button
            type="button"
            onClick={() => void copyToTargetWeek(false)}
            disabled={sameWeek || copying || loading}
            data-testid="copy-week-confirm"
            className="border-[#c91b23] bg-[#c91b23] text-white hover:bg-[#a8161d] hover:text-white"
          >
            {copying ? 'Kopiëren…' : 'Kopieer naar deze week'}
          </Button>
        </div>
      </div>
    </div>
  );
}
