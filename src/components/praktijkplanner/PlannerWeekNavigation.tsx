'use client';

import { useEffect, useMemo, useState } from 'react';
import { MonthNavigation } from '@/components/CalandarGrid/MonthNavigation';
import { formatIsoDate, startOfIsoWeek, weeksOverlappingMonth } from '@/lib/praktijkplanner/dates';
import { PLANNER_GRID_NAV_GAP_PX } from './planner-grid-layout';
import { PlannerWeekInMonthNavigation } from './PlannerWeekInMonthNavigation';

function monthContextFromWeekStart(weekStart: string) {
  const weekDate = new Date(`${weekStart}T12:00:00`);
  return { month: weekDate.getMonth(), year: weekDate.getFullYear() };
}

export function PlannerWeekNavigation({
  weekStart,
  onWeekStartChange,
}: {
  weekStart: string;
  onWeekStartChange: (weekStart: string) => void;
}) {
  const initialContext = monthContextFromWeekStart(weekStart);
  const [viewMonth, setViewMonth] = useState(initialContext.month);
  const [viewYear, setViewYear] = useState(initialContext.year);

  const weeks = useMemo(
    () => weeksOverlappingMonth(viewYear, viewMonth + 1),
    [viewMonth, viewYear]
  );

  useEffect(() => {
    if (weeks.includes(weekStart)) return;
    const context = monthContextFromWeekStart(weekStart);
    setViewMonth(context.month);
    setViewYear(context.year);
  }, [weekStart, weeks]);

  const handleSelectMonth = (selectedMonth: number, selectedYear: number) => {
    setViewMonth(selectedMonth);
    setViewYear(selectedYear);
    const monthWeeks = weeksOverlappingMonth(selectedYear, selectedMonth + 1);
    if (monthWeeks.length > 0) {
      onWeekStartChange(monthWeeks[0]);
      return;
    }
    const firstOfMonth = formatIsoDate(new Date(selectedYear, selectedMonth, 1, 12));
    onWeekStartChange(startOfIsoWeek(firstOfMonth));
  };

  return (
    <div style={{ display: 'grid', gap: `${PLANNER_GRID_NAV_GAP_PX}px` }}>
      <MonthNavigation month={viewMonth} year={viewYear} onSelectMonth={handleSelectMonth} />
      <PlannerWeekInMonthNavigation
        weekStart={weekStart}
        weeks={weeks}
        onWeekStartChange={onWeekStartChange}
      />
    </div>
  );
}
