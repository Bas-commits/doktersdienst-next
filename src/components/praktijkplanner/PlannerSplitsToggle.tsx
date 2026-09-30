'use client';

import { ExternalLink, PanelRight } from 'lucide-react';

/**
 * De knop die kiest of het nevenscherm naast het hoofdscherm komt te staan, in plaats van dat
 * vanzelf te laten gebeuren zodra het scherm breed genoeg is.
 *
 * Puur beeld, net als de andere knoppen op deze rij: hij plant zelf niets, en zet alleen de
 * voorkeur om die de pagina zelf combineert met de gemeten breedte (magSplitsen) tot
 * naastElkaar. Kaart: https://trello.com/c/TXhh6XbM
 *
 * Op een te smal scherm was de knop uitgeschakeld: een duo-scherm dat niet past kan niet. Nu
 * opent hij daar het nevenscherm in een nieuw tabblad, zodat plannen en kijken toch naast elkaar
 * kan, op twee tabbladen of twee monitoren. Kaart: https://trello.com/c/FHVfCvMC
 *
 * Args:
 *     aan: Op een breed scherm: het nevenscherm staat naast het hoofdscherm. Op een smal scherm:
 *         het nevenscherm is in een eigen tabblad geopend.
 *     teSmal: Het nevenscherm past niet naast het hoofdscherm.
 *     onChange: Op een breed scherm: zet naast elkaar aan of uit.
 *     onNieuwTabblad: Op een smal scherm: open het nevenscherm in een eigen tabblad.
 *     hoofdscherm: het scherm waar het nevenscherm naast komt te staan, voor de knoptekst - "de
 *         week" in {@link ../../pages/praktijkplanner/activiteiten.tsx}, "het rooster" in
 *         {@link ../../pages/rooster-maken-secretaris.tsx} (maandkalender, geen week). Kaart:
 *         https://trello.com/c/8lHwuHjv/
 */
export function PlannerSplitsToggle({
  aan,
  teSmal,
  onChange,
  onNieuwTabblad,
  hoofdscherm = 'de week',
}: {
  aan: boolean;
  teSmal: boolean;
  onChange: (aan: boolean) => void;
  onNieuwTabblad: () => void;
  hoofdscherm?: string;
}) {
  if (teSmal) {
    return (
      <button
        type="button"
        aria-pressed={aan}
        aria-label="Nevenscherm in nieuw tabblad"
        onClick={onNieuwTabblad}
        title={`Het scherm is te smal om het nevenscherm naast ${hoofdscherm} te zetten. Open het in een nieuw tabblad; ${hoofdscherm} blijft hier staan.`}
        className={[
          'inline-flex items-center justify-center rounded-md border p-1.5 transition',
          aan ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
        ].join(' ')}
      >
        <ExternalLink className="size-4" aria-hidden />
      </button>
    );
  }

  const label = aan ? 'Nevenscherm los van ' + hoofdscherm : 'Nevenscherm naast ' + hoofdscherm;
  return (
    <button
      type="button"
      aria-pressed={aan}
      aria-label={label}
      onClick={() => onChange(!aan)}
      title={
        aan
          ? `Zet het nevenscherm weer in de plaats van ${hoofdscherm}.`
          : `Zet het nevenscherm naast ${hoofdscherm}.`
      }
      className={[
        'inline-flex items-center justify-center rounded-md border p-1.5 transition',
        aan ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
      ].join(' ')}
    >
      <PanelRight className="size-4" aria-hidden />
    </button>
  );
}
