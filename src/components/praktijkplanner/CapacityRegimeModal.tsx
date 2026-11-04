'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { startOfIsoWeek, weekRangeLabel } from '@/lib/praktijkplanner/dates';
import type { PraktijkplannerCapacityRegime } from '@/types/praktijkplanner';

/**
 * Beheer van de regimes: de weken die niet de normale bezetting halen.
 *
 * Een week hangt aan hoogstens een regime. Dat bewaakt de database, dus een week die al bij
 * een ander regime hoort levert hier een melding op met de naam van dat regime erbij.
 */
export function CapacityRegimeModal({
  open,
  onClose,
  groupId,
  regimes,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  groupId: number;
  regimes: PraktijkplannerCapacityRegime[];
  onChanged: (regimes: PraktijkplannerCapacityRegime[]) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [nieuweNaam, setNieuweNaam] = useState('');
  const [namen, setNamen] = useState<Record<number, string>>({});
  const [nieuweWeek, setNieuweWeek] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open) return;
    setNieuweNaam('');
    setNamen(Object.fromEntries(regimes.map((regime) => [regime.id, regime.naam])));
    setNieuweWeek({});
  }, [open, regimes]);

  const stuur = useCallback(
    async (method: 'POST' | 'PUT' | 'DELETE', body: Record<string, unknown>) => {
      setSubmitting(true);
      try {
        const response = await fetch('/api/praktijkplanner/capaciteit/regimes', {
          method,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idwaarneemgroep: groupId, ...body }),
        });
        const payload = (await response.json()) as {
          regimes?: PraktijkplannerCapacityRegime[];
          error?: string;
        };
        if (!response.ok || !payload.regimes) {
          throw new Error(payload.error || 'Opslaan mislukt.');
        }
        onChanged(payload.regimes);
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Opslaan mislukt.');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [groupId, onChanged]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="capaciteit-regimes-title"
      onClick={onClose}
      data-testid="capaciteit-regimes-modal"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b px-4 py-3">
          <h2 id="capaciteit-regimes-title" className="text-lg font-semibold tracking-tight">
            Afwijkende weken
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Weken die de normale bezetting niet halen, zoals de zomer en de kerst. Een week hoort
            bij hoogstens een regime; de weken van volgend jaar wijst u zelf weer aan.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-3">
          {regimes.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="capaciteit-regimes-leeg">
              Er is nog geen regime. Elke week wordt nu aan de normale week getoetst.
            </p>
          ) : null}

          {regimes.map((regime) => (
            <div
              key={regime.id}
              className="space-y-2 rounded-lg border p-3"
              data-testid={`capaciteit-regime-${regime.id}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={namen[regime.id] ?? regime.naam}
                  maxLength={60}
                  aria-label={`Naam van ${regime.naam}`}
                  onChange={(event) =>
                    setNamen((current) => ({ ...current, [regime.id]: event.target.value }))
                  }
                  className="h-9 min-w-40 flex-1 rounded-md border bg-background px-2 text-sm"
                />
                {(namen[regime.id] ?? regime.naam).trim() !== regime.naam ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onClick={() =>
                      void stuur('PUT', {
                        idregime: regime.id,
                        naam: (namen[regime.id] ?? '').trim(),
                      })
                    }
                  >
                    Naam opslaan
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => void stuur('DELETE', { idregime: regime.id })}
                >
                  Verwijderen
                </Button>
              </div>

              {regime.weken.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nog geen weken. Zonder weken doet dit regime niets.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {regime.weken.map((maandag) => (
                    <li
                      key={maandag}
                      className="flex items-center gap-1 rounded border bg-muted/40 px-2 py-1 text-xs"
                    >
                      <span>{weekRangeLabel(maandag, { withYear: true })}</span>
                      <button
                        type="button"
                        aria-label={`Week ${weekRangeLabel(maandag, { withYear: true })} verwijderen`}
                        disabled={submitting}
                        onClick={() =>
                          void stuur('PUT', {
                            idregime: regime.id,
                            weken: regime.weken.filter((week) => week !== maandag),
                          })
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={nieuweWeek[regime.id] ?? ''}
                  aria-label={`Week toevoegen aan ${regime.naam}`}
                  onChange={(event) =>
                    setNieuweWeek((current) => ({ ...current, [regime.id]: event.target.value }))
                  }
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submitting || !nieuweWeek[regime.id]}
                  onClick={async () => {
                    const gekozen = nieuweWeek[regime.id];
                    if (!gekozen) return;
                    // Een datum ergens in de week telt als die week; de server schuift hem naar
                    // de maandag.
                    const gelukt = await stuur('PUT', {
                      idregime: regime.id,
                      weken: [...regime.weken, startOfIsoWeek(gekozen)],
                    });
                    if (gelukt) setNieuweWeek((current) => ({ ...current, [regime.id]: '' }));
                  }}
                >
                  Week toevoegen
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <input
              type="text"
              value={nieuweNaam}
              maxLength={60}
              placeholder="Naam, bijvoorbeeld Zomer"
              aria-label="Naam van het nieuwe regime"
              onChange={(event) => setNieuweNaam(event.target.value)}
              className="h-9 min-w-40 flex-1 rounded-md border bg-background px-2 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting || nieuweNaam.trim().length === 0}
              data-testid="capaciteit-regime-toevoegen"
              onClick={async () => {
                const gelukt = await stuur('POST', { naam: nieuweNaam.trim() });
                if (gelukt) setNieuweNaam('');
              }}
            >
              Regime toevoegen
            </Button>
          </div>
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
