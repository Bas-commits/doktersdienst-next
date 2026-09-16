'use client';

import { PanelRight } from 'lucide-react';

/**
 * De knop die kiest of het nevenscherm naast het hoofdscherm komt te staan, in plaats van dat
 * vanzelf te laten gebeuren zodra het scherm breed genoeg is.
 *
 * Puur beeld, net als de andere knoppen op deze rij: hij plant zelf niets, en zet alleen de
 * voorkeur om die de pagina zelf combineert met de gemeten breedte (magSplitsen) tot
 * naastElkaar. Op een smal scherm blijft de knop uit klikken: een duo-scherm dat niet past is
 * geen keuze, het is gewoon onmogelijk. Kaart: https://trello.com/c/TXhh6XbM
 *
 * Args:
 *     hoofdscherm: het scherm waar het nevenscherm naast komt te staan, voor de knoptekst - "de
 *         week" in {@link ../../pages/praktijkplanner/activiteiten.tsx}, "het rooster" in
 *         {@link ../../pages/rooster-maken-secretaris.tsx} (maandkalender, geen week). Kaart:
 *         https://trello.com/c/8lHwuHjv/
 */
export function PlannerSplitsToggle({
  aan,
  disabled,
  onChange,
  hoofdscherm = 'de week',
}: {
  aan: boolean;
  disabled: boolean;
  onChange: (aan: boolean) => void;
  hoofdscherm?: string;
}) {
  const label = aan ? 'Nevenscherm los van ' + hoofdscherm : 'Nevenscherm naast ' + hoofdscherm;
  return (
    <button
      type="button"
      aria-pressed={aan}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!aan)}
      title={
        disabled
          ? `Het scherm is te smal om het nevenscherm naast ${hoofdscherm} te zetten.`
          : aan
            ? `Zet het nevenscherm weer in de plaats van ${hoofdscherm}.`
            : `Zet het nevenscherm naast ${hoofdscherm}.`
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
