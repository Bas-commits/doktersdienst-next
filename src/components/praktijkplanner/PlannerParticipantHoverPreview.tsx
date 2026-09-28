'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CURSOR_GAP, placeNearCursor, type HoverPosition } from './PlannerDaypartHoverPreview';
import type { PraktijkplannerParticipantExpertise } from '@/types/praktijkplanner';

/**
 * Dezelfde schermpje-aanpak als PlannerDaypartHoverPreview (fiche-mouseover): een kaartje dat
 * met een korte vertraging naast de cursor verschijnt zolang de muis op het element blijft.
 * Eigen component omdat de inhoud hier alleen naam en expertises is, niet de dagdeel-velden
 * van de fiche-preview.
 */
export function PlannerParticipantHoverPreview({
  participantName,
  expertises,
  children,
}: {
  participantName: string;
  expertises: PraktijkplannerParticipantExpertise[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<HoverPosition | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const delayRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!open || !cursor || !popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    setCoords(placeNearCursor(cursor, rect.width, rect.height));
  }, [open, cursor, participantName, expertises]);

  useEffect(() => {
    return () => {
      if (delayRef.current != null) window.clearTimeout(delayRef.current);
    };
  }, []);

  return (
    <>
      <div
        className="min-w-0"
        onMouseEnter={(event) => {
          if (delayRef.current != null) window.clearTimeout(delayRef.current);
          const point = { x: event.clientX, y: event.clientY };
          delayRef.current = window.setTimeout(() => {
            setCursor(point);
            setOpen(true);
          }, 120);
        }}
        onMouseMove={(event) => {
          setCursor({ x: event.clientX, y: event.clientY });
        }}
        onMouseLeave={() => {
          if (delayRef.current != null) {
            window.clearTimeout(delayRef.current);
            delayRef.current = null;
          }
          setOpen(false);
          setCursor(null);
          setCoords(null);
        }}
      >
        {children}
      </div>
      {open && cursor && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popupRef}
              className="pointer-events-none fixed z-[110] w-56 rounded-xl border bg-background p-3 shadow-xl"
              style={{
                left: coords?.left ?? cursor.x + CURSOR_GAP,
                top: coords?.top ?? cursor.y + CURSOR_GAP,
                visibility: coords ? 'visible' : 'hidden',
              }}
              role="tooltip"
            >
              <p className="text-sm font-semibold">{participantName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {expertises.length > 0
                  ? expertises.map((expertise) => expertise.naam).join(', ')
                  : 'Geen expertise bekend'}
              </p>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
