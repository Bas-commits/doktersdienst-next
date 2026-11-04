'use client';

import { addDays, startOfIsoWeek, weekRangeLabel } from '@/lib/praktijkplanner/dates';
import { PLANNER_WEEK_IN_MONTH_NAV_HEIGHT_PX } from './planner-grid-layout';

/** Aantal weken dat de dubbele pijlen in een keer opschuiven. */
const WEEK_JUMP = 4;

/**
 * Weken links en rechts van de gekozen week.
 *
 * Drie knoppen: de vorige week, deze week en de volgende. Met vijf was de balk 649 pixels en
 * paste de koprij met de zijbalk open niet meer op een regel; de twee buitenste links kosten
 * daar samen ruim 200 van. Verder terug of vooruit gaat met de pijlen ernaast, dus er is
 * niets onbereikbaar geworden.
 */
const WEEKS_AROUND = 1;

const ChevronLeft = ({ double = false }: { double?: boolean }) => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path
      fillRule="evenodd"
      d="M9.78 4.22a.75.75 0 0 1 0 1.06L6.84 8l2.94 2.72a.75.75 0 1 1-1.04 1.08l-3.5-3.25a.75.75 0 0 1 0-1.08l3.5-3.25a.75.75 0 0 1 1.04 1.06Z"
      clipRule="evenodd"
    />
    {double ? (
      <path
        fillRule="evenodd"
        d="M14.28 4.22a.75.75 0 0 1 0 1.06L11.34 8l2.94 2.72a.75.75 0 1 1-1.04 1.08l-3.5-3.25a.75.75 0 0 1 0-1.08l3.5-3.25a.75.75 0 0 1 1.04 1.06Z"
        clipRule="evenodd"
      />
    ) : null}
  </svg>
);

const ChevronRight = ({ double = false }: { double?: boolean }) => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path
      fillRule="evenodd"
      d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.5 3.25a.75.75 0 0 1 0 1.08l-3.5 3.25a.75.75 0 0 1-1.04-1.08L9.16 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
      clipRule="evenodd"
    />
    {double ? (
      <path
        fillRule="evenodd"
        d="M1.72 4.22a.75.75 0 0 1 1.06 0l3.5 3.25a.75.75 0 0 1 0 1.08l-3.5 3.25a.75.75 0 0 1-1.04-1.08L4.66 8 1.72 5.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    ) : null}
  </svg>
);

/**
 * De weekbalk loopt door over maandgrenzen heen. Eerder hing hij onder een maandregel en
 * toonde alleen de weken van die maand, waardoor de pijlen aan het eind van een maand
 * doodliepen en je eerst een maand moest aanklikken. Het jaartal staat bij de gekozen week,
 * de enige plek waar het nog te lezen valt nu de maandregel weg is.
 */
export function PlannerWeekBar({
  weekStart,
  onWeekStartChange,
}: {
  weekStart: string;
  onWeekStartChange: (weekStart: string) => void;
}) {
  const activeWeek = startOfIsoWeek(weekStart);
  const weeks = Array.from({ length: WEEKS_AROUND * 2 + 1 }, (_, index) =>
    addDays(activeWeek, (index - WEEKS_AROUND) * 7)
  );

  const shiftWeeks = (count: number) => onWeekStartChange(addDays(activeWeek, count * 7));

  return (
    <div
      className="flex min-w-0 items-center justify-center"
      style={{ minHeight: `${PLANNER_WEEK_IN_MONTH_NAV_HEIGHT_PX}px` }}
    >
      <nav className="flex min-w-0 items-center" aria-label="Weeknavigatie">
        <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-3 gap-y-2 p-0">
          {[
            { count: -WEEK_JUMP, label: `${WEEK_JUMP} weken terug`, icon: <ChevronLeft double /> },
            { count: -1, label: 'Vorige week', icon: <ChevronLeft /> },
          ].map(({ count, label, icon }) => (
            <li key={label} className="list-none p-0">
              <button
                type="button"
                className="flex cursor-pointer items-center justify-center border-none bg-transparent px-1 py-1 text-gray-800 transition-opacity hover:opacity-80"
                aria-label={label}
                title={label}
                onClick={() => shiftWeeks(count)}
              >
                {icon}
              </button>
            </li>
          ))}
          {weeks.map((week) => {
            const isActive = week === activeWeek;
            return (
              <li key={week} className="list-none p-0">
                <button
                  type="button"
                  className={[
                    'cursor-pointer whitespace-nowrap border-none bg-transparent py-1 font-inherit transition-colors duration-150',
                    isActive
                      ? 'px-1 text-[1.05em] font-bold text-gray-800'
                      : 'font-normal text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-gray-700',
                  ].join(' ')}
                  onClick={() => onWeekStartChange(week)}
                  aria-label={`Ga naar week ${weekRangeLabel(week, { withYear: true })}`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {weekRangeLabel(week, { withYear: isActive })}
                </button>
              </li>
            );
          })}
          {[
            { count: 1, label: 'Volgende week', icon: <ChevronRight /> },
            { count: WEEK_JUMP, label: `${WEEK_JUMP} weken vooruit`, icon: <ChevronRight double /> },
          ].map(({ count, label, icon }) => (
            <li key={label} className="list-none p-0">
              <button
                type="button"
                className="flex cursor-pointer items-center justify-center border-none bg-transparent px-1 py-1 text-gray-800 transition-opacity hover:opacity-80"
                aria-label={label}
                title={label}
                onClick={() => shiftWeeks(count)}
              >
                {icon}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
