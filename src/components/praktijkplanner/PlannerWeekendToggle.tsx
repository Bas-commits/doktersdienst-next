'use client';

import { CalendarOff } from 'lucide-react';

/**
 * De knop die zaterdag en zondag uit het rooster haalt of terugzet.
 *
 * Puur beeld, net als de knop voor avond en nacht ernaast: er wordt niets opgeslagen of
 * weggegooid, en wat in het weekend gepland staat komt met dezelfde klik weer terug. Groepen
 * die alleen doordeweeks werken houden zo twee kolommen ruimte over.
 *
 * Alleen het icoontje, met de tekst in de tooltip, om dezelfde reden als bij die andere knop:
 * uitgeschreven past de koprij met de zijbalk open niet meer op een regel. De stand is aan de
 * kleur te zien.
 *
 * De knop staat aan als het weekend weg is. Dat is de kant die iets doet, en het is ook hoe de
 * kaart hem noemt: weekend niet tonen, aan of uit.
 */
export function PlannerWeekendToggle({
  verborgen,
  onChange,
}: {
  verborgen: boolean;
  onChange: (verborgen: boolean) => void;
}) {
  const label = verborgen ? 'Weekend tonen' : 'Weekend verbergen';
  return (
    <button
      type="button"
      aria-pressed={verborgen}
      aria-label={label}
      onClick={() => onChange(!verborgen)}
      title={
        verborgen
          ? 'Zaterdag en zondag weer tonen'
          : 'Zaterdag en zondag verbergen. Er wordt niets verwijderd; wat er staat komt terug zodra je ze weer toont.'
      }
      className={[
        'inline-flex items-center justify-center rounded-md border p-1.5 transition',
        verborgen ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
      ].join(' ')}
    >
      <CalendarOff className="size-4" aria-hidden />
    </button>
  );
}
