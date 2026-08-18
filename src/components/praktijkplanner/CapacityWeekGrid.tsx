'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { PraktijkplannerDaypart } from '@/types/praktijkplanner';
import { DAYPART_ICONS } from './absence-icons';
import { UNAVAILABLE_DAYPART_TOAST } from './PlannerDaypartGrid';
import {
  PlannerCursorToolFollower,
  UNAVAILABLE_DAYPART_CURSOR_TOOL,
} from './PlannerCursorTool';

export const CAPACITY_WEEKDAYS = [
  { id: 1, label: 'Maandag' },
  { id: 2, label: 'Dinsdag' },
  { id: 3, label: 'Woensdag' },
  { id: 4, label: 'Donderdag' },
  { id: 5, label: 'Vrijdag' },
  { id: 6, label: 'Zaterdag' },
  { id: 7, label: 'Zondag' },
] as const;

export type CapacityWeekday = (typeof CAPACITY_WEEKDAYS)[number];

type CapacityWeekGridProps = {
  dayparts: PraktijkplannerDaypart[];
  /** Optional weekday header override (e.g. date labels on overzicht). */
  weekdayHeaders?: ReactNode[];
  renderCell: (weekday: CapacityWeekday, daypart: PraktijkplannerDaypart) => ReactNode;
  isCellUnavailable?: (weekday: CapacityWeekday, daypart: PraktijkplannerDaypart) => boolean;
  /**
   * Wat er op een niet-inplanbaar vakje toch te zien is.
   *
   * Diensten mogen op zo'n dagdeel wel staan, dus een vakje dat er een draagt heeft meer te
   * melden dan "Niet inplanbaar". Geeft dit niets terug, dan blijft het bij die tekst.
   */
  renderUnavailableCell?: (
    weekday: CapacityWeekday,
    daypart: PraktijkplannerDaypart
  ) => ReactNode;
  /**
   * Het vakje waar de klok nu in staat. Alleen ingevuld door schermen die echte datums
   * tonen; de capaciteitsplanner is een sjabloon per weekdag en kent geen vandaag.
   */
  isCurrentCell?: (weekday: CapacityWeekday, daypart: PraktijkplannerDaypart) => boolean;
  className?: string;
  /** ISO-weekdagen die de groep nooit gebruikt. Zie weekdagenZonderRooster. */
  verborgenWeekdagen?: ReadonlySet<number>;
};

export function CapacityWeekGrid({
  dayparts,
  weekdayHeaders,
  renderCell,
  isCellUnavailable,
  renderUnavailableCell,
  isCurrentCell,
  className,
  verborgenWeekdagen,
}: CapacityWeekGridProps) {
  // De kop die een scherm meegeeft staat op de plek van de volledige week, dus die moet mee
  // gefilterd worden op dezelfde index. Anders komt de datum onder de verkeerde dag te staan.
  const alleHeaders = weekdayHeaders ?? CAPACITY_WEEKDAYS.map((day) => day.label);
  const dagen = CAPACITY_WEEKDAYS.map((weekday, index) => ({
    weekday,
    header: alleHeaders[index],
  })).filter(({ weekday }) => !verborgenWeekdagen?.has(weekday.id));
  const [unavailableCursor, setUnavailableCursor] = useState<{ x: number; y: number } | null>(null);

  const trackUnavailableCursor = (event: { clientX: number; clientY: number }) => {
    setUnavailableCursor({ x: event.clientX, y: event.clientY });
  };

  return (
    <div className={['overflow-x-auto rounded-xl border bg-card shadow-sm', className].filter(Boolean).join(' ')}>
      {/* De minimumbreedte volgt het aantal kolommen; met zeven dagen is dit de oude 1100. */}
      <table
        className="w-full border-collapse text-sm"
        style={{ minWidth: `${120 + dagen.length * 140}px` }}
      >
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="sticky left-0 z-10 border-b border-r bg-muted/40 p-3 text-left font-semibold">
              Dagdeel
            </th>
            {dagen.map(({ weekday, header }) => (
              <th key={weekday.id} className="border-b p-3 text-center font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dayparts.map((daypart) => {
            const icon = DAYPART_ICONS[daypart.volgorde];
            return (
              <tr key={daypart.id} className="border-t align-top">
                <th className="sticky left-0 z-10 border-r bg-card p-3 text-center font-medium align-middle">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <span>{daypart.naam}</span>
                    {icon ? (
                      <Image src={icon} alt="" width={28} height={28} className="size-10" />
                    ) : null}
                  </div>
                </th>
                {dagen.map(({ weekday }) => {
                  const unavailable = isCellUnavailable?.(weekday, daypart) ?? false;
                  const unavailableInhoud = unavailable
                    ? renderUnavailableCell?.(weekday, daypart)
                    : null;
                  const isNu = isCurrentCell?.(weekday, daypart) ?? false;
                  return (
                    <td
                      key={`${weekday.id}:${daypart.id}`}
                      className={[
                        'border-l p-2 align-top',
                        unavailable ? 'bg-muted/40 opacity-50' : '',
                        isNu ? 'ring-2 ring-inset ring-emerald-600' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {unavailable && unavailableInhoud ? (
                        unavailableInhoud
                      ) : unavailable ? (
                        <button
                          type="button"
                          onClick={() => toast.info(UNAVAILABLE_DAYPART_TOAST)}
                          onPointerEnter={trackUnavailableCursor}
                          onPointerMove={trackUnavailableCursor}
                          onPointerLeave={() => setUnavailableCursor(null)}
                          className="flex min-h-16 w-full cursor-none items-center justify-center rounded text-xs text-muted-foreground"
                        >
                          Niet inplanbaar
                        </button>
                      ) : (
                        renderCell(weekday, daypart)
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <PlannerCursorToolFollower
        tool={unavailableCursor ? UNAVAILABLE_DAYPART_CURSOR_TOOL : null}
        position={unavailableCursor}
      />
    </div>
  );
}
