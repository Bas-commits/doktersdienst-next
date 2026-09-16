'use client';

import { PanelRight } from 'lucide-react';

/**
 * De knop die kiest of het nevenscherm naast de week komt te staan, in plaats van dat vanzelf
 * te laten gebeuren zodra het scherm breed genoeg is.
 *
 * Puur beeld, net als de andere knoppen op deze rij: hij plant zelf niets, en zet alleen de
 * voorkeur om die {@link ../../pages/praktijkplanner/activiteiten.tsx} combineert met de gemeten
 * breedte (magSplitsen) tot naastElkaar. Op een smal scherm blijft de knop uit klikken: een
 * duo-scherm dat niet past is geen keuze, het is gewoon onmogelijk. Kaart:
 * https://trello.com/c/TXhh6XbM
 */
export function PlannerSplitsToggle({
  aan,
  disabled,
  onChange,
}: {
  aan: boolean;
  disabled: boolean;
  onChange: (aan: boolean) => void;
}) {
  const label = aan ? 'Nevenscherm los van de week' : 'Nevenscherm naast de week';
  return (
    <button
      type="button"
      aria-pressed={aan}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!aan)}
      title={
        disabled
          ? 'Het scherm is te smal om het nevenscherm naast de week te zetten.'
          : aan
            ? 'Zet het nevenscherm weer in de plaats van de week.'
            : 'Zet het nevenscherm naast de week.'
      }
      className={[
        'inline-flex items-center justify-center rounded-md border p-1.5 transition',
        disabled
          ? 'cursor-not-allowed text-muted-foreground/40'
          : aan
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted',
      ].join(' ')}
    >
      <PanelRight className="size-4" aria-hidden />
    </button>
  );
}
