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
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
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
    <div className="flex h-full min-h-0 min-w-[1024px] flex-col space-y-5 p-6">
      {/*
        De koprij blijft staan tijdens het scrollen. Schermen zetten hun weeknavigatie in het
        middenvak hiernaast, en die moet bereikbaar blijven als je halverwege de deelnemers
        zit. De negatieve marges trekken de achtergrond door de paginamarge heen, anders
        schuift het rooster langs de zijkanten van de vastgezette rij omhoog.
      */}
      <div className="sticky top-0 z-40 -mx-6 -mt-6 bg-background px-6 pb-3 pt-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <div ref={setTitleAsideSlot} className="flex flex-wrap items-center justify-center gap-3 self-center" />
          <div className="flex justify-end self-start">
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              {context.groupName ?? 'Waarneemgroep'}
            </span>
          </div>
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
