'use client';

import { useState } from 'react';
import { CalendarGrid, type CalendarGridRow } from './CalendarGrid';
import type { ShiftBlockView } from '@/types/diensten';

export interface CalendarGridWithNavStateProps {
  /** Rows per waarneemgroep (when set, shiftBlocks is ignored). */
  rows?: CalendarGridRow[];
  /** Single set of shift blocks when not using rows. */
  shiftBlocks?: ShiftBlockView[];
  /** Initial month (0-based, e.g. 2 = March). Default 2. */
  initialViewMonth?: number;
  /** Initial year. Default 2025. */
  initialViewYear?: number;
}

/**
 * Calendar grid with internal month/year state and navigation.
 * Use this when you don't need to control the view from outside.
 */
export function CalendarGridWithNavState({
  rows,
  shiftBlocks,
  initialViewMonth = 2,
  initialViewYear = 2025,
}: CalendarGridWithNavStateProps) {
  const [viewMonth, setViewMonth] = useState(initialViewMonth);
  const [viewYear, setViewYear] = useState(initialViewYear);

  return (
    <CalendarGrid
      rows={rows}
      shiftBlocks={shiftBlocks}
      viewMonth={viewMonth}
      viewYear={viewYear}
      onViewMonthChange={(month, year) => {
        setViewMonth(month);
        setViewYear(year);
      }}
    />
  );
}
