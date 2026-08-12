'use client';

import { Moon } from 'lucide-react';

/**
 * De knop die avond en nacht in beeld zet of eruit haalt.
 *
 * Puur beeld: er wordt niets opgeslagen of weggegooid, en wat verborgen is komt met dezelfde
 * klik weer terug. Ochtend en middag zijn de drukke dagdelen en krijgen zo de ruimte.
 *
 * Het label zegt wat de klik doet, niet in welke stand hij staat. Dat kan nu ook waargemaakt
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
  return (
    <button
      type="button"
      aria-pressed={aan}
      onClick={() => onChange(!aan)}
      title={
        aan
          ? 'Haal avond en nacht uit beeld. Er wordt niets verwijderd; wat gepland staat komt terug zodra je ze weer toont.'
          : 'Toon avond en nacht, ook als er niets in staat, zodat er iets in te plannen valt'
      }
      className={[
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition',
        aan ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
      ].join(' ')}
    >
      <Moon className="size-3.5" aria-hidden />
      {aan ? 'Avond en nacht verbergen' : 'Avond en nacht tonen'}
    </button>
  );
}
