'use client';

import type { PlannerNevenscherm } from '@/hooks/praktijkplanner/usePlannerWeergave';

const LABELS: Record<PlannerNevenscherm, string> = {
  geen: 'Week',
  maand: 'Maand',
  capaciteit: 'Capaciteit',
  locatie: 'Locatie',
};

/**
 * De keuze wat er naast de week komt te staan.
 *
 * Dit was een schakelaar tussen week en maand, dus het een of het ander. Links staat nu altijd
 * de week en deze knop kiest wat daarnaast komt. Past dat niet, dan komt de keuze in de plaats
 * van de week; dat is precies wat de oude schakelaar deed, en het is de reden dat er geen
 * waarschuwing bij hoeft. Een melding dat een scherm te smal is kan de lezer toch niet
 * verhelpen.
 *
 * Args:
 *     keuzes: Welke nevenschermen dit scherm kent. De Afwezigheidsplanner heeft geen
 *         capaciteit en geen locatie, en toont die knoppen dus ook niet.
 *     naastElkaar: Of de keuze naast de week komt of ervoor in de plaats. Bepaalt alleen de
 *         uitleg bij de knop; de keuze zelf blijft hetzelfde. Een scherm dat helemaal geen
 *         panelen kent geeft hier onwaar, want daar vervangt de keuze altijd de week.
 */
export function PlannerNevenschermKeuze({
  value,
  onChange,
  keuzes,
  naastElkaar,
}: {
  value: PlannerNevenscherm;
  onChange: (value: PlannerNevenscherm) => void;
  keuzes: readonly PlannerNevenscherm[];
  naastElkaar: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-md border">
        {keuzes.map((keuze) => (
          <button
            key={keuze}
            type="button"
            aria-pressed={value === keuze}
            title={
              keuze === 'geen'
                ? 'Alleen de week'
                : naastElkaar
                  ? `${LABELS[keuze]} naast de week`
                  : `${LABELS[keuze]} in plaats van de week`
            }
            className={[
              'px-2 py-1 text-xs font-medium transition',
              value === keuze
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            ].join(' ')}
            onClick={() => onChange(keuze)}
          >
            {LABELS[keuze]}
          </button>
        ))}
      </div>
    </div>
  );
}
