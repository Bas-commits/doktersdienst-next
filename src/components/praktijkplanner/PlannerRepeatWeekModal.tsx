'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { addDays, startOfIsoWeek } from '@/lib/praktijkplanner/dates';
import { notifyPlannerChanged } from '@/lib/praktijkplanner/planner-change-broadcast';

export function PlannerRepeatWeekModal({
  open,
  onClose,
  groupId,
  participantId,
  participantName,
  sourceWeekStart,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  groupId: number;
  participantId: number;
  participantName: string;
  sourceWeekStart: string;
  onCreated?: () => void;
}) {
  const [beginWeek, setBeginWeek] = useState(() => addDays(sourceWeekStart, 7));
  const [endWeek, setEndWeek] = useState(() => addDays(sourceWeekStart, 28));
  const [frequencyWeeks, setFrequencyWeeks] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [overwriteConfirm, setOverwriteConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBeginWeek(addDays(sourceWeekStart, 7));
    setEndWeek(addDays(sourceWeekStart, 28));
    setFrequencyWeeks('1');
    setOverwriteConfirm(false);
  }, [open, sourceWeekStart]);

  if (!open) return null;

  const normalizedBegin = startOfIsoWeek(beginWeek);
  const normalizedEnd = startOfIsoWeek(endWeek);
  const canSubmit =
    normalizedBegin > sourceWeekStart &&
    normalizedBegin <= normalizedEnd &&
    !submitting;

  async function createSeries(overwrite: boolean) {
    if (!canSubmit && !overwrite) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/praktijkplanner/activiteiten/herhaling', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          idwaarneemgroep: groupId,
          iddeelnemer: participantId,
          bronStartdatum: sourceWeekStart,
          startdatum: normalizedBegin,
          einddatum: normalizedEnd,
          frequentieWeken: Number(frequencyWeeks),
          overwrite,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (response.status === 409 && !overwrite) {
        setOverwriteConfirm(true);
        return;
      }
      if (!response.ok) throw new Error(payload.error || 'Herhaling aanmaken mislukt.');
      toast.success(overwrite ? 'Herhaling aangemaakt (bestaande planning overschreven).' : 'Herhaling aangemaakt.');
      notifyPlannerChanged(groupId);
      onCreated?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Herhaling aanmaken mislukt.');
    } finally {
      setSubmitting(false);
    }
  }

  if (overwriteConfirm) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repeat-overwrite-modal-title"
        onClick={onClose}
        data-testid="repeat-overwrite-modal"
      >
        <div
          className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="repeat-overwrite-modal-title" className="mb-2 text-lg font-semibold tracking-tight">
            Bestaande planning overschrijven?
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            In een of meer geselecteerde doelweken staat al een planning voor {participantName}.
            Wilt u deze overschrijven met de herhaalde week?
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOverwriteConfirm(false)}
              disabled={submitting}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              onClick={() => createSeries(true)}
              disabled={submitting}
              data-testid="repeat-overwrite-confirm"
              className="border-[#c91b23] bg-[#c91b23] text-white hover:bg-[#a8161d] hover:text-white"
            >
              {submitting ? 'Bezig…' : 'Overschrijven'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repeat-week-modal-title"
      onClick={onClose}
      data-testid="repeat-week-modal"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="repeat-week-modal-title" className="mb-1 text-lg font-semibold tracking-tight">
          Week herhalen — {participantName}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          De planning van de huidige week wordt herhaald vanaf de gekozen beginweek tot en met
          de eindweek.
        </p>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Beginweek</span>
            <input
              type="date"
              value={beginWeek}
              min={addDays(sourceWeekStart, 7)}
              onChange={(event) => setBeginWeek(startOfIsoWeek(event.target.value || beginWeek))}
              className="h-9 rounded-md border bg-background px-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Eindweek</span>
            <input
              type="date"
              value={endWeek}
              min={beginWeek}
              onChange={(event) => setEndWeek(startOfIsoWeek(event.target.value || endWeek))}
              className="h-9 rounded-md border bg-background px-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Frequentie</span>
            <select
              value={frequencyWeeks}
              onChange={(event) => setFrequencyWeeks(event.target.value)}
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="1">Elke week</option>
              <option value="2">Om de week</option>
              <option value="3">Elke 3 weken</option>
            </select>
          </label>
        </div>

        {normalizedBegin <= sourceWeekStart ? (
          <p className="mt-3 text-sm text-destructive">
            De beginweek moet na de bronweek liggen.
          </p>
        ) : null}
        {normalizedBegin > normalizedEnd ? (
          <p className="mt-3 text-sm text-destructive">
            De eindweek mag niet vóór de beginweek liggen.
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuleren
          </Button>
          <Button
            type="button"
            onClick={() => createSeries(false)}
            disabled={!canSubmit}
            data-testid="repeat-week-confirm"
            className="border-[#c91b23] bg-[#c91b23] text-white hover:bg-[#a8161d] hover:text-white"
          >
            {submitting ? 'Bezig…' : 'Herhaling aanmaken'}
          </Button>
        </div>
      </div>
    </div>
  );
}
