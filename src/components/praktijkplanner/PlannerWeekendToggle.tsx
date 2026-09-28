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
 * Kaart dPp/dDd:verberg-knoppen grijs tonen als ze overruled worden: standaard wit in de
 * uit-stand (er is niets te verbergen), maar grijs zodra er wél een dienst in het weekend
 * staat die daardoor niet te zien is - `verbergtIets` geeft dat aan. `effectiefGetoond` is
 * voor het scherm dat weet of +Diensten deze knop overrulet en dus toch iets toont; zonder dat
 * scherm valt hij terug op `getoond` en gedraagt de knop zich als voorheen (twee standen).
 */
export function PlannerWeekendToggle({
  getoond,
  effectiefGetoond,
  verbergtIets = false,
  onChange,
}: {
  /** De eigen voorkeur van de gebruiker; bepaalt wat een klik terugstuurt. */
  getoond: boolean;
  /** Is het weekend op dit moment echt te zien, inclusief een eventuele overrule door +Diensten. Standaard gelijk aan getoond. */
  effectiefGetoond?: boolean;
  /** Staat de knop op verbergen terwijl er wél een dienst in het weekend staat. */
  verbergtIets?: boolean;
  onChange: (getoond: boolean) => void;
}) {
  const isGetoond = effectiefGetoond ?? getoond;
  const label = isGetoond ? 'Weekend verbergen' : 'Weekend tonen';
  return (
    <button
      type="button"
      aria-pressed={isGetoond}
      aria-label={label}
      onClick={() => onChange(!getoond)}
      title={
        isGetoond
          ? 'Zaterdag en zondag verbergen. Er wordt niets verwijderd; wat er staat komt terug zodra je ze weer toont.'
          : verbergtIets
            ? 'Er staat een dienst in het weekend die nu verborgen is. Klik om te tonen, of zet +Diensten aan om diensten automatisch te laten zien.'
            : 'Zaterdag en zondag weer tonen'
      }
      className={[
        'inline-flex items-center justify-center rounded-md border p-1.5 transition',
        isGetoond
          ? 'bg-primary text-primary-foreground'
          : verbergtIets
            ? 'bg-muted text-muted-foreground'
            : 'text-muted-foreground hover:bg-muted',
      ].join(' ')}
    >
      <CalendarOff className="size-4" aria-hidden />
    </button>
  );
}
