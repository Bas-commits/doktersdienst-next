'use client';

import { CalendarOff } from 'lucide-react';

/**
 * De knop die zaterdag en zondag uit het rooster haalt of terugzet.
 *
 * Puur beeld, net als de knop voor avond en nacht ernaast: er wordt niets aan de planning
 * veranderd, en wat in het weekend staat komt met dezelfde klik weer terug. Groepen die alleen
 * doordeweeks werken houden zo twee kolommen ruimte over.
 *
 * De stand zelf wordt wel bewaard, per deelnemer en waarneemgroep, in dezelfde tabel als die
 * andere knop. Zie useWeekendVoorkeur.
 *
 * Alleen het icoontje, met de tekst in de tooltip, om dezelfde reden als bij die andere knop:
 * uitgeschreven past de koprij met de zijbalk open niet meer op een regel. De stand is aan de
 * kleur te zien.
 *
 * De knop staat aan als het weekend te zien is, net als bij avond en nacht ernaast: gevuld
 * betekent daar ook "wordt getoond", niet "de klik heeft iets gedaan". Eerder stond hij aan
 * als het weekend juist weg was - dezelfde kleur betekende dan het tegenovergestelde van bij
 * de knop ernaast, en dat was voor de kaart dPp:Diensten tonen de reden om de twee gelijk te
 * trekken.
 */
export function PlannerWeekendToggle({
  getoond,
  onChange,
}: {
  getoond: boolean;
  onChange: (getoond: boolean) => void;
}) {
  const label = getoond ? 'Weekend verbergen' : 'Weekend tonen';
  return (
    <button
      type="button"
      aria-pressed={getoond}
      aria-label={label}
      onClick={() => onChange(!getoond)}
      title={
        getoond
          ? 'Zaterdag en zondag verbergen. Er wordt niets verwijderd; wat er staat komt terug zodra je ze weer toont.'
          : 'Zaterdag en zondag weer tonen'
      }
      className={[
        'inline-flex items-center justify-center rounded-md border p-1.5 transition',
        getoond ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
      ].join(' ')}
    >
      <CalendarOff className="size-4" aria-hidden />
    </button>
  );
}
