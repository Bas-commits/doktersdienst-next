'use client';

import { weekRangeLabel } from '@/lib/praktijkplanner/dates';
import { PLANNER_WEEK_IN_MONTH_NAV_HEIGHT_PX } from './planner-grid-layout';

const ArrowLeft = () => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path
      fillRule="evenodd"
      d="M9.78 4.22a.75.75 0 0 1 0 1.06L6.84 8l2.94 2.72a.75.75 0 1 1-1.04 1.08l-3.5-3.25a.75.75 0 0 1 0-1.08l3.5-3.25a.75.75 0 0 1 1.04 1.06Z"
      clipRule="evenodd"
    />
  </svg>
);

const ArrowRight = () => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path
      fillRule="evenodd"
      d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.5 3.25a.75.75 0 0 1 0 1.08l-3.5 3.25a.75.75 0 0 1-1.04-1.08L9.16 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
      clipRule="evenodd"
    />
  </svg>
);

export function PlannerWeekInMonthNavigation({
  weekStart,
  weeks,
  onWeekStartChange,
}: {
  weekStart: string;
  weeks: string[];
  onWeekStartChange: (weekStart: string) => void;
}) {
  if (weeks.length === 0) return null;

  const currentIndex = Math.max(0, weeks.indexOf(weekStart));
  const activeWeekStart = weeks[currentIndex] ?? weeks[0];

  return (
    <div
      className="flex min-w-0 items-center justify-center"
      style={{ height: `${PLANNER_WEEK_IN_MONTH_NAV_HEIGHT_PX}px` }}
    >
      <nav className="flex min-w-0 items-center" aria-label="Weeknavigatie">
        <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-3 gap-y-2 p-0">
          <li className="list-none p-0">
            <button
              type="button"
              className="flex cursor-pointer items-center justify-center border-none bg-transparent px-2 py-1 text-gray-800 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Vorige week"
              disabled={currentIndex <= 0}
              onClick={() => onWeekStartChange(weeks[currentIndex - 1])}
            >
              <ArrowLeft />
            </button>
          </li>
          {weeks.map((week, index) => {
            const isActive = week === activeWeekStart;
            return (
              <li key={week} className="list-none p-0">
                <button
                  type="button"
                  className={[
                    'cursor-pointer border-none bg-transparent py-1 font-inherit transition-colors duration-150',
                    isActive
                      ? 'px-1 text-[1.05em] font-bold text-gray-800'
                      : 'font-normal text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-gray-700',
                  ].join(' ')}
                  onClick={() => onWeekStartChange(week)}
                  aria-label={`Ga naar week ${weekRangeLabel(week)}`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {weekRangeLabel(week)}
                </button>
              </li>
            );
          })}
          <li className="list-none p-0">
            <button
              type="button"
              className="flex cursor-pointer items-center justify-center border-none bg-transparent px-2 py-1 text-gray-800 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Volgende week"
              disabled={currentIndex >= weeks.length - 1}
              onClick={() => onWeekStartChange(weeks[currentIndex + 1])}
            >
              <ArrowRight />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
