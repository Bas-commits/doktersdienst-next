'use client';

import { Moon } from 'lucide-react';
import { toast } from 'sonner';

/**
 * De knop die de lege rijen Avond en Nacht in beeld houdt.
 *
 * Zonder deze knop is het automatisch verbergen een val: staat er niets in de avond, dan is
 * de rij weg, en dan valt er ook nooit een eerste avond in te plannen.
 *
 * Het label zegt wat de klik doet, niet in welke stand hij staat: "Avond en nacht tonen" of
 * "Avond en nacht verbergen". Dat belooft net iets te veel, want verbergen lukt alleen zolang
 * die dagdelen leeg zijn; wat gepland staat blijft staan, anders zou werk onzichtbaar worden.
 * Die nuance staat in de tooltip en niet op de knop, want een knop die "Lege avond en nacht"
 * heet vraagt meer uitleg dan hij bespaart.
 *
 * Hij blijft altijd klikbaar. Een eerdere versie schakelde zichzelf uit zodra er iets gepland
 * stond, en dat las als een kapotte knop.
 */
export function PlannerAvondNachtToggle({
  aan,
  heeftInhoud,
  onChange,
}: {
  aan: boolean;
  /** Er staat iets gepland in avond of nacht, dus verbergen levert in deze periode niets op. */
  heeftInhoud: boolean;
  onChange: (aan: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={aan}
      onClick={() => {
        // De keuze wordt wel bewaard, dus zonder deze melding lijkt de knop kapot: je klikt
        // op verbergen en er verandert niets, terwijl hij in een lege week wel werkt.
        if (aan && heeftInhoud) {
          toast.info(
            'Avond en nacht blijven in deze periode staan, want er staat iets gepland. In een periode zonder avond- of nachtplanning zijn ze verborgen.'
          );
        }
        onChange(!aan);
      }}
      title={
        aan
          ? 'Verbergen lukt alleen zolang avond en nacht leeg zijn. Wat gepland staat blijft staan.'
          : 'Toon avond en nacht ook als er niets in staat, zodat er iets in te plannen valt'
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
