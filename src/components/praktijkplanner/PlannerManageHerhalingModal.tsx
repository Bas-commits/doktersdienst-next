'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { startOfIsoWeek } from '@/lib/praktijkplanner/dates';

export type ManagedHerhalingSeries = {
  id: number;
  iddeelnemer: number;
  startdatum: string;
  einddatum: string;
  frequentieWeken: number;
};

type DeleteScope = 'entire' | 'fromWeek';
type DeleteMode = 'unlink' | 'deletePlanning';

type View =
  | { kind: 'list' }
  | { kind: 'edit'; series: ManagedHerhalingSeries }
  | {
      kind: 'delete';
      series: ManagedHerhalingSeries;
      scope: DeleteScope;
      vanaf: string;
      mode: DeleteMode;
    };

function frequencyLabel(weeks: number): string {
  if (weeks === 1) return 'elke week';
  if (weeks === 2) return 'om de week';
  return `elke ${weeks} weken`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${iso}T12:00:00`));
}

export function PlannerManageHerhalingModal({
  open,
  onClose,
  groupId,
  participantId,
  participantName,
  defaultVanafWeekStart,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  groupId: number;
  participantId: number;
  participantName: string;
  /** ISO week start used as default for "vanaf deze week". */
  defaultVanafWeekStart: string;
  onChanged?: () => void;
}) {
  const [series, setSeries] = useState<ManagedHerhalingSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [editDraft, setEditDraft] = useState<ManagedHerhalingSeries | null>(null);

  const loadSeries = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/praktijkplanner/activiteiten/herhaling?idwaarneemgroep=${groupId}&iddeelnemer=${participantId}`,
        { credentials: 'include' }
      );
      const payload = (await response.json()) as {
        series?: ManagedHerhalingSeries[];
        error?: string;
      };
      if (!response.ok || !payload.series) {
        throw new Error(payload.error || 'Herhalingen konden niet worden geladen.');
      }
      setSeries(payload.series);
    } catch (error) {
      setSeries([]);
      toast.error(error instanceof Error ? error.message : 'Herhalingen konden niet worden geladen.');
    } finally {
      setLoading(false);
    }
  }, [groupId, participantId]);

  useEffect(() => {
    if (!open) return;
    setView({ kind: 'list' });
    setEditDraft(null);
    void loadSeries();
  }, [loadSeries, open]);

  async function saveEdit() {
    if (!editDraft) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/praktijkplanner/activiteiten/herhaling', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          idwaarneemgroep: groupId,
          idherhaling: editDraft.id,
          startdatum: editDraft.startdatum,
          einddatum: editDraft.einddatum,
          frequentieWeken: editDraft.frequentieWeken,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Herhaling bijwerken mislukt.');
      toast.success('Herhaling bijgewerkt.');
      setView({ kind: 'list' });
      setEditDraft(null);
      onChanged?.();
      await loadSeries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Herhaling bijwerken mislukt.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (view.kind !== 'delete') return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/praktijkplanner/activiteiten/herhaling', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          idwaarneemgroep: groupId,
          idherhaling: view.series.id,
          mode: view.mode,
          ...(view.scope === 'fromWeek' ? { vanaf: startOfIsoWeek(view.vanaf) } : {}),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Herhaling verwijderen mislukt.');
      toast.success(
        view.mode === 'deletePlanning'
          ? 'Herhaling en planning verwijderd.'
          : 'Herhalingspatroon verwijderd; planning behouden.'
      );
      setView({ kind: 'list' });
      onChanged?.();
      await loadSeries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Herhaling verwijderen mislukt.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  if (view.kind === 'delete') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-herhaling-delete-title"
        onClick={onClose}
        data-testid="manage-herhaling-delete-modal"
      >
        <div
          className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="manage-herhaling-delete-title" className="mb-2 text-lg font-semibold tracking-tight">
            Herhaling verwijderen?
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {formatDate(view.series.startdatum)} t/m {formatDate(view.series.einddatum)} ·{' '}
            {frequencyLabel(view.series.frequentieWeken)}
          </p>

          <fieldset className="mb-4 grid gap-2">
            <legend className="mb-1 text-sm font-medium">Bereik</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="delete-scope"
                checked={view.scope === 'entire'}
                onChange={() => setView({ ...view, scope: 'entire' })}
              />
              Hele herhaling
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="delete-scope"
                checked={view.scope === 'fromWeek'}
                onChange={() => setView({ ...view, scope: 'fromWeek' })}
              />
              Vanaf deze week
            </label>
            {view.scope === 'fromWeek' ? (
              <label className="ml-6 grid gap-1 text-sm">
                <span className="font-medium">Week (maandag)</span>
                <input
                  type="date"
                  value={view.vanaf}
                  onChange={(event) =>
                    setView({
                      ...view,
                      vanaf: startOfIsoWeek(event.target.value || view.vanaf),
                    })
                  }
                  className="h-9 rounded-md border bg-background px-2"
                  data-testid="manage-herhaling-vanaf"
                />
              </label>
            ) : null}
          </fieldset>

          <fieldset className="mb-6 grid gap-2">
            <legend className="mb-1 text-sm font-medium">Effect</legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="delete-mode"
                className="mt-0.5"
                checked={view.mode === 'unlink'}
                onChange={() => setView({ ...view, mode: 'unlink' })}
              />
              <span>Alleen patroon verwijderen (planning behouden)</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="delete-mode"
                className="mt-0.5"
                checked={view.mode === 'deletePlanning'}
                onChange={() => setView({ ...view, mode: 'deletePlanning' })}
              />
              <span>Ook planning verwijderen</span>
            </label>
          </fieldset>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setView({ kind: 'list' })}
              disabled={submitting}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={submitting}
              data-testid="manage-herhaling-delete-confirm"
              className="border-[#c91b23] bg-[#c91b23] text-white hover:bg-[#a8161d] hover:text-white"
            >
              {submitting ? 'Bezig…' : 'Verwijderen'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view.kind === 'edit' && editDraft) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-herhaling-edit-title"
        onClick={onClose}
        data-testid="manage-herhaling-edit-modal"
      >
        <div
          className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="manage-herhaling-edit-title" className="mb-4 text-lg font-semibold tracking-tight">
            Herhaling bewerken
          </h2>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Start</span>
              <input
                type="date"
                value={editDraft.startdatum}
                onChange={(event) =>
                  setEditDraft({ ...editDraft, startdatum: event.target.value || editDraft.startdatum })
                }
                className="h-9 rounded-md border bg-background px-2"
                data-testid="manage-herhaling-edit-start"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Einde</span>
              <input
                type="date"
                value={editDraft.einddatum}
                onChange={(event) =>
                  setEditDraft({ ...editDraft, einddatum: event.target.value || editDraft.einddatum })
                }
                className="h-9 rounded-md border bg-background px-2"
                data-testid="manage-herhaling-edit-end"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Frequentie</span>
              <select
                value={editDraft.frequentieWeken}
                onChange={(event) =>
                  setEditDraft({ ...editDraft, frequentieWeken: Number(event.target.value) })
                }
                className="h-9 rounded-md border bg-background px-2"
                data-testid="manage-herhaling-edit-frequency"
              >
                <option value={1}>Elke week</option>
                <option value={2}>Om de week</option>
                <option value={3}>Elke 3 weken</option>
              </select>
            </label>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setView({ kind: 'list' });
                setEditDraft(null);
              }}
              disabled={submitting}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              onClick={() => void saveEdit()}
              disabled={submitting || editDraft.startdatum > editDraft.einddatum}
              data-testid="manage-herhaling-edit-save"
              className="border-[#c91b23] bg-[#c91b23] text-white hover:bg-[#a8161d] hover:text-white"
            >
              {submitting ? 'Bezig…' : 'Bijwerken'}
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
      aria-labelledby="manage-herhaling-modal-title"
      onClick={onClose}
      data-testid="manage-herhaling-modal"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b px-4 py-3">
          <h2 id="manage-herhaling-modal-title" className="text-lg font-semibold tracking-tight">
            Herhalingen — {participantName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bewerk of verwijder actieve herhalingen voor deze deelnemer.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {loading ? <p className="text-sm text-muted-foreground">Laden…</p> : null}
          {!loading && series.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="manage-herhaling-empty">
              Geen actieve herhalingen voor deze deelnemer.
            </p>
          ) : null}
          {!loading && series.length > 0 ? (
            <ul className="space-y-2">
              {series.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  data-testid={`manage-herhaling-item-${item.id}`}
                >
                  <span>
                    {formatDate(item.startdatum)} t/m {formatDate(item.einddatum)} ·{' '}
                    {frequencyLabel(item.frequentieWeken)}
                  </span>
                  <span className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditDraft({ ...item });
                        setView({ kind: 'edit', series: item });
                      }}
                    >
                      Bewerken
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        setView({
                          kind: 'delete',
                          series: item,
                          scope: 'entire',
                          vanaf: startOfIsoWeek(defaultVanafWeekStart),
                          mode: 'unlink',
                        })
                      }
                    >
                      Verwijderen
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex justify-end border-t px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Sluiten
          </Button>
        </div>
      </div>
    </div>
  );
}
