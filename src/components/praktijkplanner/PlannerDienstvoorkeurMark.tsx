'use client';

import { Check, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PraktijkplannerDienstvoorkeurWaarde } from '@/types/praktijkplanner';
import { brightenHex } from './absence-icons';

/*
  Kleur en pictogram komen van de voorkeurenpagina van de dienstenplanner: groen met een vinkje
  voor graag, geel met een kruisje voor liever niet. Een arts die beide systemen gebruikt ziet
  dan tweemaal hetzelfde teken en hoeft niet te leren dat het hier iets anders betekent.
*/
export const DIENSTVOORKEUR_WEERGAVE: Record<
  PraktijkplannerDienstvoorkeurWaarde,
  { label: string; kleur: string; Icon: LucideIcon }
> = {
  graag: { label: 'Dienst graag', kleur: '#22c55e', Icon: Check },
  liever_niet: { label: 'Dienst liever niet', kleur: '#eab308', Icon: X },
};

/**
 * Het opschrift van een dienstvoorkeur, met vraagteken zolang het een aanvraag is.
 *
 * Dezelfde afspraak als bij de afwezigheidstypen: een vraagteken betekent gevraagd en nog niet
 * vastgelegd.
 */
export function dienstvoorkeurLabel(
  voorkeur: PraktijkplannerDienstvoorkeurWaarde,
  aangevraagd: boolean
): string {
  const { label } = DIENSTVOORKEUR_WEERGAVE[voorkeur];
  return aangevraagd ? `${label}?` : label;
}

/** De kleur van het teken: lichter zolang het een aanvraag is, net als bij een afwezigheid. */
export function dienstvoorkeurKleur(
  voorkeur: PraktijkplannerDienstvoorkeurWaarde,
  aangevraagd: boolean
): string {
  const { kleur } = DIENSTVOORKEUR_WEERGAVE[voorkeur];
  return aangevraagd ? brightenHex(kleur, 0.18) : kleur;
}

/**
 * De dienstvoorkeur op een dagdeel.
 *
 * Twee vormen, omdat een dagdeel allebei kan dragen. Zonder afwezigheid vult de voorkeur het
 * hele vakje; staat er wel een afwezigheid, dan wordt het een hoekje daarop. Dat is de
 * afspraak dat een botsing zichtbaar blijft in plaats van dat er een van de twee verdwijnt.
 *
 * Een aanvraag krijgt de lichtere kleur en een streepjesrand. Alleen de kleur was te weinig:
 * lichtgroen naast groen is in een klein vakje nauwelijks te zien, en dit is het verschil
 * tussen een wens van de arts en een afspraak van de planner.
 */
export function PlannerDienstvoorkeurMark({
  voorkeur,
  aangevraagd = false,
  variant = 'vol',
}: {
  voorkeur: PraktijkplannerDienstvoorkeurWaarde;
  aangevraagd?: boolean;
  variant?: 'vol' | 'hoek';
}) {
  const { Icon } = DIENSTVOORKEUR_WEERGAVE[voorkeur];
  const label = dienstvoorkeurLabel(voorkeur, aangevraagd);
  const kleur = dienstvoorkeurKleur(voorkeur, aangevraagd);

  if (variant === 'hoek') {
    return (
      <span
        className={cn(
          'pointer-events-none absolute -bottom-0.5 -left-0.5 flex size-4 items-center justify-center rounded-full ring-1 ring-white/70',
          aangevraagd && 'border border-dashed border-white/90'
        )}
        style={{ background: kleur }}
        aria-label={label}
      >
        <Icon className="size-3 text-white" strokeWidth={3} aria-hidden />
      </span>
    );
  }

  return (
    <span className="absolute inset-0.5 block" title={label} aria-label={label}>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center rounded-md',
          aangevraagd && 'border-2 border-dashed border-white/90'
        )}
        style={{ background: kleur }}
      >
        <Icon className="size-6 text-white" strokeWidth={3} aria-hidden />
      </span>
    </span>
  );
}
