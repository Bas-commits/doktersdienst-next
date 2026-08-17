'use client';

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type PraktijkplannerContextData,
  usePraktijkplannerContext,
} from '@/hooks/praktijkplanner/usePraktijkplannerContext';

export type PraktijkplannerPageContext = {
  groupId: number;
  groupName: string | null;
  data: PraktijkplannerContextData;
  reload: () => void;
};

const TitleAsideSlotContext = createContext<HTMLElement | null>(null);

/** Renders children centered in the page header row, between title and group badge. */
export function PraktijkplannerTitleAside({ children }: { children: ReactNode }) {
  const slot = useContext(TitleAsideSlotContext);
  if (!slot) return null;
  return createPortal(children, slot);
}

export function PraktijkplannerPage({
  title,
  children,
}: {
  title: string;
  children: (context: PraktijkplannerPageContext) => ReactNode;
}) {
  const context = usePraktijkplannerContext();
  const [titleAsideSlot, setTitleAsideSlot] = useState<HTMLElement | null>(null);

  if (context.loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6" role="status">
        <p className="text-muted-foreground">Praktijkplanner laden…</p>
      </div>
    );
  }

  if (!context.data || !context.groupId) {
    return (
      <div className="p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{context.error ?? 'De Praktijkplanner is niet beschikbaar.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    // h-full plus min-h-0 geeft de inhoud een echte hoogte om binnen te scrollen. Schermen
    // die daar niets mee doen stapelen gewoon zoals eerst.
    // De ruimte tussen de kop en het rooster is klein gehouden: de kop staat vast en de rest
    // van het scherm scrollt eronderdoor, dus elke pixel daar gaat direct van het rooster af.
    <div className="flex h-full min-h-0 min-w-[1024px] flex-col space-y-2 p-6">
      {/*
        De koprij blijft staan tijdens het scrollen. Schermen zetten hun weeknavigatie er in, en
        die moet bereikbaar blijven als je halverwege de deelnemers zit. De negatieve marges
        trekken de achtergrond door de paginamarge heen, anders schuift het rooster langs de
        zijkanten van de vastgezette rij omhoog.

        De kop had ook een uitleg per scherm en de naam van de waarneemgroep. Beide zijn eruit:
        de uitleg zegt niets meer zodra je het scherm een keer kent, en de groep staat al boven
        in de balk. Wat overblijft is de titel met de navigatie ernaast. Die navigatie stond
        eerst op een eigen regel omdat de uitleg naast een opengeklapte zijbalk in vijf smalle
        regeltjes uiteenviel; zonder uitleg speelt dat niet meer. flex-wrap vangt op wat toch
        niet past: dan zakt de navigatie vanzelf naar de tweede regel.
      */}
      <div className="sticky top-0 z-40 -mx-6 -mt-6 bg-background px-6 pb-2 pt-4">
        {/*
          De navigatie sluit aan op de titel en wordt niet naar rechts geduwd. Met
          justify-between stond er een gat van een paar honderd pixels tussen, en zodra de
          zijbalk openging paste de navigatie er niet meer naast: die viel dan op een eigen
          regel en stond daar tegen de rechterrand aangedrukt, met datzelfde gat ervoor.
        */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {/*
            Leeg als een scherm geen navigatie in de kop zet. Dan valt het blok weg in plaats van
            een lege strook over te houden.
          */}
          <div
            ref={setTitleAsideSlot}
            className="flex min-w-0 flex-wrap items-center gap-3 empty:hidden"
          />
        </div>
      </div>
      <TitleAsideSlotContext.Provider value={titleAsideSlot}>
        {children({
          groupId: context.groupId,
          groupName: context.groupName,
          data: context.data,
          reload: context.reload,
        })}
      </TitleAsideSlotContext.Provider>
    </div>
  );
}
