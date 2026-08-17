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
 */
export function PlannerAvondNachtToggle({
  aan,
  onChange,
}: {
  aan: boolean;
  onChange: (aan: boolean) => void;
}) {
  const label = aan ? 'Avond en nacht verbergen' : 'Avond en nacht tonen';
  return (
    <button
      type="button"
      aria-pressed={aan}
      aria-label={label}
      onClick={() => onChange(!aan)}
      title={
        aan
          ? 'Avond en nacht verbergen. Er wordt niets verwijderd; wat gepland staat komt terug zodra je ze weer toont.'
          : 'Avond en nacht tonen, ook als er niets in staat, zodat er iets in te plannen valt'
      }
      className={[
        'inline-flex items-center justify-center rounded-md border p-1.5 transition',
        aan ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
      ].join(' ')}
    >
      <Moon className="size-4" aria-hidden />
    </button>
  );
}
