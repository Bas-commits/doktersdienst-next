'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

/** De maand voluit, zoals de weekbalk zijn datums schrijft: kleine letter, jaartal erbij. */
function maandLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1, 12)
  );
}

/**
 * De maand die het maandoverzicht toont, met een knop naar de vorige en de volgende.
 *
 * Zonder deze regel stond er nergens welke maand er onder de weekbalk hing. De balk noemt een
 * week die over een maandgrens kan lopen, dus bij 31 aug - 6 sep kon het overzicht net zo goed
 * augustus als september zijn.
 *
 * De knoppen verzetten de week en niet een eigen maand. Week en maand zijn hier hetzelfde
 * ding: schermen leiden hun maand af van de week met maandVanWeek, juist zodat de twee niet
 * uit elkaar kunnen lopen. Een maand vooruit zet de week dus op de eerste week van die maand.
 */
export function PlannerMaandNavigatie({
  year,
  month,
  onMaandVerzetten,
}: {
  year: number;
  month: number;
  onMaandVerzetten: (stap: number) => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-center overflow-hidden rounded-md border text-muted-foreground">
      <button
        type="button"
        className="px-1 py-1 transition hover:bg-muted"
        aria-label="Vorige maand"
        title="Vorige maand"
        onClick={() => onMaandVerzetten(-1)}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <span className="px-1 text-xs font-medium whitespace-nowrap text-foreground">
        {maandLabel(year, month)}
      </span>
      <button
        type="button"
        className="px-1 py-1 transition hover:bg-muted"
        aria-label="Volgende maand"
        title="Volgende maand"
        onClick={() => onMaandVerzetten(1)}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}
