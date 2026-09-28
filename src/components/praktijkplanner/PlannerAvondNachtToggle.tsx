'use client';

import { Moon } from 'lucide-react';

/**
 * De knop die avond en nacht in beeld zet of eruit haalt.
 *
 * Puur beeld: er wordt niets opgeslagen of weggegooid, en wat verborgen is komt met dezelfde
 * klik weer terug. Ochtend en middag zijn de drukke dagdelen en krijgen zo de ruimte.
 *
 * Alleen het maantje, met de tekst in de tooltip. Uitgeschreven was de knop 175 pixels breed
 * en paste de koprij met de zijbalk open niet meer op een regel. De stand is aan de kleur te
 * zien, net als bij de keuzeknop ernaast.
 *
 * De tooltip zegt wat de klik doet, niet in welke stand hij staat. Dat kan ook waargemaakt
 * worden: verbergen lukt altijd. Eerder hielden avond en nacht zichzelf zichtbaar zodra er
 * iets in stond, en dan deed de knop in de ene week niets en in de andere wel.
 *
 * Kaart dPp/dDd:verberg-knoppen grijs tonen als ze overruled worden: standaard wit in de
 * uit-stand (er is niets te verbergen), maar grijs zodra er wél een dienst in avond of nacht
 * staat die daardoor niet te zien is - `verbergtIets` geeft dat aan. `getoond` is voor het
 * scherm dat wél weet of +Diensten deze knop overrulet en dus iets toont ondanks `aan` false;
 * zonder dat scherm valt hij terug op `aan` en gedraagt de knop zich als voorheen (twee standen).
 */
export function PlannerAvondNachtToggle({
  aan,
  getoond,
  verbergtIets = false,
  onChange,
}: {
  /** De eigen voorkeur van de gebruiker; bepaalt wat een klik terugstuurt. */
  aan: boolean;
  /** Is avond/nacht op dit moment echt te zien, inclusief een eventuele overrule door +Diensten. Standaard gelijk aan aan. */
  getoond?: boolean;
  /** Staat de knop op verbergen terwijl er wél een dienst in avond of nacht staat. */
  verbergtIets?: boolean;
  onChange: (aan: boolean) => void;
}) {
  const isGetoond = getoond ?? aan;
  const label = isGetoond ? 'Avond en nacht verbergen' : 'Avond en nacht tonen';
  return (
    <button
      type="button"
      aria-pressed={isGetoond}
      aria-label={label}
      onClick={() => onChange(!aan)}
      title={
        isGetoond
          ? 'Avond en nacht verbergen. Er wordt niets verwijderd; wat gepland staat komt terug zodra je ze weer toont.'
          : verbergtIets
            ? 'Er staat een dienst in avond of nacht die nu verborgen is. Klik om te tonen, of zet +Diensten aan om diensten automatisch te laten zien.'
            : 'Avond en nacht tonen, ook als er niets in staat, zodat er iets in te plannen valt'
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
      <Moon className="size-4" aria-hidden />
    </button>
  );
}
