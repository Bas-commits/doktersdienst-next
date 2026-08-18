'use client';

import { Check, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PraktijkplannerDienstvoorkeurWaarde } from '@/types/praktijkplanner';

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
 * De dienstvoorkeur op een dagdeel.
 *
 * Twee vormen, omdat een dagdeel allebei kan dragen. Zonder afwezigheid vult de voorkeur het
 * hele vakje; staat er wel een afwezigheid, dan wordt het een hoekje daarop. Dat is de
 * afspraak dat een botsing zichtbaar blijft in plaats van dat er een van de twee verdwijnt.
 */
export function PlannerDienstvoorkeurMark({
  voorkeur,
  variant = 'vol',
}: {
  voorkeur: PraktijkplannerDienstvoorkeurWaarde;
  variant?: 'vol' | 'hoek';
}) {
  const { label, kleur, Icon } = DIENSTVOORKEUR_WEERGAVE[voorkeur];

  if (variant === 'hoek') {
    return (
      <span
        className="pointer-events-none absolute -bottom-0.5 -left-0.5 flex size-4 items-center justify-center rounded-full ring-1 ring-white/70"
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
        className={cn('absolute inset-0 flex items-center justify-center rounded-md')}
        style={{ background: kleur }}
      >
        <Icon className="size-6 text-white" strokeWidth={3} aria-hidden />
      </span>
    </span>
  );
}
