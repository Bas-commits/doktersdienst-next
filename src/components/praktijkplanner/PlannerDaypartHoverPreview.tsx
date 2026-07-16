'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const CURSOR_GAP = 50;
const VIEWPORT_PAD = 8;

type HoverPosition = { x: number; y: number };

function placeNearCursor(
  cursor: HoverPosition,
  width: number,
  height: number
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const candidates: Array<{ left: number; top: number }> = [
    // right
    { left: cursor.x + CURSOR_GAP, top: cursor.y - height / 2 },
    // left
    { left: cursor.x - CURSOR_GAP - width, top: cursor.y - height / 2 },
    // below
    { left: cursor.x - width / 2, top: cursor.y + CURSOR_GAP },
    // above
    { left: cursor.x - width / 2, top: cursor.y - CURSOR_GAP - height },
  ];

  for (const candidate of candidates) {
    const fitsX =
      candidate.left >= VIEWPORT_PAD && candidate.left + width <= vw - VIEWPORT_PAD;
    const fitsY =
      candidate.top >= VIEWPORT_PAD && candidate.top + height <= vh - VIEWPORT_PAD;
    if (fitsX && fitsY) {
      return {
        left: candidate.left,
        top: Math.min(
          Math.max(candidate.top, VIEWPORT_PAD),
          vh - VIEWPORT_PAD - height
        ),
      };
    }
  }

  // Fallback: clamp preferred right placement into the viewport
  return {
    left: Math.min(
      Math.max(cursor.x + CURSOR_GAP, VIEWPORT_PAD),
      Math.max(VIEWPORT_PAD, vw - VIEWPORT_PAD - width)
    ),
    top: Math.min(
      Math.max(cursor.y - height / 2, VIEWPORT_PAD),
      Math.max(VIEWPORT_PAD, vh - VIEWPORT_PAD - height)
    ),
  };
}

function formatDateLabel(datum: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${datum}T12:00:00`));
}

export function PlannerDaypartHoverPreview({
  enabled,
  participantName,
  initials,
  datum,
  daypartName,
  fromRepetition,
  isException,
  availabilityName,
  chip,
  children,
}: {
  enabled: boolean;
  participantName: string;
  initials: string;
  datum: string;
  daypartName: string;
  fromRepetition: boolean;
  isException: boolean;
  availabilityName?: string | null;
  chip: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<HoverPosition | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const delayRef = useRef<number | null>(null);

  useEffect(() => {
    if (enabled) return;
    setOpen(false);
    setCursor(null);
    setCoords(null);
    if (delayRef.current != null) {
      window.clearTimeout(delayRef.current);
      delayRef.current = null;
    }
  }, [enabled]);

  useLayoutEffect(() => {
    if (!open || !cursor || !popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    setCoords(placeNearCursor(cursor, rect.width, rect.height));
  }, [open, cursor, chip, participantName, daypartName]);

  useEffect(() => {
    return () => {
      if (delayRef.current != null) window.clearTimeout(delayRef.current);
    };
  }, []);

  return (
    <>
      <div
        className="h-full w-full min-w-0"
        onMouseEnter={(event) => {
          if (!enabled) return;
          if (delayRef.current != null) window.clearTimeout(delayRef.current);
          const point = { x: event.clientX, y: event.clientY };
          delayRef.current = window.setTimeout(() => {
            setCursor(point);
            setOpen(true);
          }, 120);
        }}
        onMouseMove={(event) => {
          if (!enabled) return;
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
      {enabled && open && cursor && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popupRef}
              className={cn(
                'pointer-events-none fixed z-[110] w-64 rounded-xl border bg-background p-3 shadow-xl',
                isException && 'border-amber-400'
              )}
              style={{
                left: coords?.left ?? cursor.x + CURSOR_GAP,
                top: coords?.top ?? cursor.y + CURSOR_GAP,
                visibility: coords ? 'visible' : 'hidden',
              }}
              role="tooltip"
            >
              <div className="mx-auto mb-3 h-28 w-44 pb-2">{chip}</div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Naam</dt>
                  <dd className="text-right font-medium">{participantName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Initialen</dt>
                  <dd className="font-medium">{initials || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Datum</dt>
                  <dd className="text-right font-medium">{formatDateLabel(datum)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Dagdeel</dt>
                  <dd className="font-medium">{daypartName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Herhaling</dt>
                  <dd className="font-medium">{fromRepetition ? 'Ja' : 'Nee'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Uitzondering</dt>
                  <dd
                    className={cn(
                      'inline-flex items-center gap-1 font-medium',
                      isException && 'text-amber-600'
                    )}
                  >
                    {isException ? (
                      <>
                        <TriangleAlert className="size-3.5" aria-hidden />
                        Ja
                      </>
                    ) : (
                      'Nee'
                    )}
                  </dd>
                </div>
                {availabilityName ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Beschikbaarheid</dt>
                    <dd className="text-right font-medium">{availabilityName}</dd>
                  </div>
                ) : null}
              </dl>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
