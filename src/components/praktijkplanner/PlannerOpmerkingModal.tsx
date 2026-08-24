'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Wat het scherm moet weten om een opmerking bij een fiche te kunnen zetten. */
export type PlannerOpmerkingDoel = {
  iddeelnemer: number;
  deelnemerNaam: string;
  datum: string;
  iddagdeel: number;
  dagdeelNaam: string;
  opmerking: string | null;
  /** Null als deze fiche niet uit een herhaling komt; dan is er niets om over te vragen. */
  recurrenceId: number | null;
};

function datumTekst(datum: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${datum}T12:00:00`));
}

/**
 * De opmerking bij een fiche, met de keuze of hij voor de hele herhaling geldt.
 *
 * Die keuze staat er alleen als de fiche uit een herhaling komt. Een vinkje dat niets doet is
 * erger dan geen vinkje: het suggereert dat er een reeks is om aan te vinken.
 *
 * De reeks staat als losse planningsregels in de database, dus "voor de hele herhaling" zet
 * dezelfde tekst bij elke fiche van die reeks. Wie later een van die fiches aanpast, past
 * alleen die ene aan. Dat is dezelfde afspraak als voor de planning zelf.
 */
export function PlannerOpmerkingModal({
  open,
  doel,
  groupId,
  onClose,
  onSaved,
}: {
  open: boolean;
  doel: PlannerOpmerkingDoel | null;
  groupId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tekst, setTekst] = useState('');
  const [voorHeleHerhaling, setVoorHeleHerhaling] = useState(false);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTekst(doel?.opmerking ?? '');
    // Standaard alleen deze fiche. Een opmerking gaat meestal over die ene dag, en per
    // ongeluk een hele reeks beschrijven is lastiger terug te draaien dan andersom.
    setVoorHeleHerhaling(false);
  }, [doel?.opmerking, open]);

  if (!open || !doel) return null;

  const bestaandeTekst = doel.opmerking ?? '';
  const gewijzigd = tekst.trim() !== bestaandeTekst.trim();

  const opslaan = async () => {
    setBezig(true);
    try {
      const response = await fetch('/api/praktijkplanner/activiteiten/opmerking', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          iddeelnemer: doel.iddeelnemer,
          datum: doel.datum,
          iddagdeel: doel.iddagdeel,
          opmerking: tekst,
          voorHeleHerhaling,
        }),
      });
      const payload = (await response.json()) as { error?: string; slotIds?: number[] };
      if (!response.ok) throw new Error(payload.error || 'De opmerking kon niet worden opgeslagen.');
      const aantal = payload.slotIds?.length ?? 1;
      toast.success(
        tekst.trim() === ''
          ? 'Opmerking verwijderd.'
          : aantal > 1
            ? `Opmerking op ${aantal} fiches gezet.`
            : 'Opmerking opgeslagen.'
      );
      onSaved();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'De opmerking kon niet worden opgeslagen.'
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="planner-opmerking-title"
      onClick={onClose}
      data-testid="planner-opmerking-modal"
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b px-4 py-3">
          <h2 id="planner-opmerking-title" className="text-lg font-semibold tracking-tight">
            Opmerking bij de fiche
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {doel.deelnemerNaam} op {datumTekst(doel.datum)}, {doel.dagdeelNaam.toLowerCase()}.
          </p>
        </div>

        <div className="space-y-3 px-4 py-3">
          <textarea
            autoFocus
            rows={4}
            value={tekst}
            onChange={(event) => setTekst(event.target.value)}
            placeholder="Bijvoorbeeld: alleen tot 12 uur aanwezig"
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            data-testid="planner-opmerking-tekst"
          />
          {doel.recurrenceId != null ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={voorHeleHerhaling}
                onChange={(event) => setVoorHeleHerhaling(event.target.checked)}
                data-testid="planner-opmerking-herhaling"
              />
              <span>
                Voor alle fiches van deze herhaling
                <span className="block text-xs text-muted-foreground">
                  Zonder dit vinkje staat de opmerking alleen bij deze ene fiche.
                </span>
              </span>
            </label>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={bezig}>
            Annuleren
          </Button>
          <Button type="button" onClick={() => void opslaan()} disabled={bezig || !gewijzigd}>
            {bezig ? 'Bezig…' : 'Opslaan'}
          </Button>
        </div>
      </div>
    </div>
  );
}
