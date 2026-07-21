import type { ReactNode } from 'react';
import type { PraktijkplannerDaypart } from '@/types/praktijkplanner';

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
  className?: string;
};

export function CapacityWeekGrid({
  dayparts,
  weekdayHeaders,
  renderCell,
  className,
}: CapacityWeekGridProps) {
  const headers = weekdayHeaders ?? CAPACITY_WEEKDAYS.map((day) => day.label);

  return (
    <div className={['overflow-x-auto rounded-xl border bg-card shadow-sm', className].filter(Boolean).join(' ')}>
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="sticky left-0 z-10 border-b border-r bg-muted/40 p-3 text-left font-semibold">
              Dagdeel
            </th>
            {CAPACITY_WEEKDAYS.map((weekday, index) => (
              <th key={weekday.id} className="border-b p-3 text-center font-semibold">
                {headers[index]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dayparts.map((daypart) => (
            <tr key={daypart.id} className="border-t align-top">
              <th className="sticky left-0 z-10 border-r bg-card p-3 text-left font-medium">{daypart.naam}</th>
              {CAPACITY_WEEKDAYS.map((weekday) => (
                <td key={`${weekday.id}:${daypart.id}`} className="border-l p-2 align-top">
                  {renderCell(weekday, daypart)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
