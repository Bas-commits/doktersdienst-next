'use client';

import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Waarschuwing bij een dagdeel dat zowel een afwezigheid als een dienstvoorkeur krijgt.
 *
 * De arts kiest zelf, en beide gegevens blijven staan. Stilzwijgend een van de twee weggooien
 * zou betekenen dat er iets is opgeslagen wat niemand heeft ingevoerd; dat is precies wat hier
 * niet mag gebeuren.
 */
export function PlannerDienstvoorkeurConflictModal({
  open,
  melding,
  onBevestig,
  onAnnuleer,
}: {
  open: boolean;
  melding: string;
  onBevestig: () => void;
  onAnnuleer: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dienstvoorkeur-conflict-titel"
      onClick={onAnnuleer}
      data-testid="dienstvoorkeur-conflict-modal"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="dienstvoorkeur-conflict-titel"
          className="mb-2 flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <TriangleAlert className="size-5 text-amber-500" aria-hidden />
          Dit spreekt elkaar tegen
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">{melding}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onAnnuleer}>
            Annuleren
          </Button>
          <Button type="button" onClick={onBevestig} data-testid="dienstvoorkeur-conflict-bevestig">
            Toch opslaan
          </Button>
        </div>
      </div>
    </div>
  );
}
