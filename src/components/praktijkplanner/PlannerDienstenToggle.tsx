'use client';

import { Stethoscope } from 'lucide-react';

/**
 * De knop die Avond/Nacht en het weekend vanzelf laat meekomen zodra er een dienst in staat.
 *
 * Puur beeld, net als de twee knoppen ernaast: hij verbergt of toont zelf niets, en slaat zelf
 * ook geen dagdeel of dag op. Hij zet alleen de voorkeur om die {@link ../../pages/praktijkplanner/activiteiten.tsx}
 * gebruikt om, wanneer er daadwerkelijk een dienst in Avond/Nacht of het weekend staat
 * ingepland, die anders verborgen dagdelen en dagen er toch bij te laten zien - een leeg
 * weekend of een lege avond blijft gewoon weg.
 *
 * Kaart dPp:Diensten tonen: eerder moest je daarvoor zelf Avond/Nacht en Weekend aanzetten en
 * weer terugzetten, en was dat pas te zien als je toevallig de activiteit Diensten aanklikte.
 */
export function PlannerDienstenToggle({
  aan,
  onChange,
}: {
  aan: boolean;
  onChange: (aan: boolean) => void;
}) {
  const label = aan ? 'Diensten niet meer automatisch tonen' : 'Diensten automatisch tonen';
  return (
    <button
      type="button"
      aria-pressed={aan}
      aria-label={label}
      onClick={() => onChange(!aan)}
      title={
        aan
          ? 'Avond/Nacht en het weekend komen nu automatisch mee zodra er een dienst in staat.'
          : 'Laat Avond/Nacht en het weekend automatisch zien zodra daar een dienst in gepland staat, ook als je ze verder verborgen houdt.'
      }
      className={[
        'inline-flex items-center justify-center rounded-md border p-1.5 transition',
        aan ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
      ].join(' ')}
    >
      <Stethoscope className="size-4" aria-hidden />
    </button>
  );
}
