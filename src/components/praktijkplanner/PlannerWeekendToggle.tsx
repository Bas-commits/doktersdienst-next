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
 *
 * Kaart dPp/dDd:verberg-knoppen grijs tonen als ze overruled worden: de "uit"-stand is een
 * gevulde grijze knop, niet een kale witte - zo is in één oogopslag te zien dat de knop iets
 * verbergt, ook als het effect (bijvoorbeeld door +Diensten) niet zichtbaar is. `overruled`
 * verandert alleen de tooltip: die legt dan uit waarom er toch iets te zien is. Alleen de
 * Activiteiten planner kent +Diensten, dus overige schermen laten overruled gewoon op false
 * staan.
 */
export function PlannerWeekendToggle({
  getoond,
  overruled = false,
  onChange,
}: {
  getoond: boolean;
  overruled?: boolean;
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
        overruled
          ? 'Het weekend staat aan omdat +Diensten een dienst laat zien, ook al staat deze knop op verbergen.'
          : getoond
            ? 'Zaterdag en zondag verbergen. Er wordt niets verwijderd; wat er staat komt terug zodra je ze weer toont.'
            : 'Zaterdag en zondag weer tonen'
      }
      className={[
        'inline-flex items-center justify-center rounded-md border p-1.5 transition',
        getoond ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70',
      ].join(' ')}
    >
      <CalendarOff className="size-4" aria-hidden />
    </button>
  );
}
