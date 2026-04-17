'use client';

import { useState } from 'react';
import { CalendarGrid, type CalendarGridRow } from './CalendarGrid';
import type { ShiftBlockView } from '@/types/diensten';
import type { ChipDefinition, VoorkeurItem } from '@/types/voorkeuren';
import type { ShiftBlockSection } from '@/types/rooster-maken';
import type { CalendarVakantieItem } from '@/types/calendar-vakanties';

export interface CalendarGridWithNavStateProps {
  /** Rows per waarneemgroep (when set, shiftBlocks is ignored). */
  rows?: CalendarGridRow[];
  /** Single set of shift blocks when not using rows. */
  shiftBlocks?: ShiftBlockView[];
  /** Initial month (0-based, e.g. 2 = March). Default 2. */
  initialViewMonth?: number;
  /** Initial year. Default 2025. */
  initialViewYear?: number;
  /** When set, view is controlled by parent (use with viewMonth, viewYear, onViewMonthChange). */
  viewMonth?: number;
  /** When set with viewMonth and onViewMonthChange, view is controlled. */
  viewYear?: number;
  /** Called when user changes month/year. When set with viewMonth/viewYear, view is controlled. */
  onViewMonthChange?: (month: number, year: number) => void;
  /** When true, the top (Achterwacht) strip is not rendered. */
  hideTopStrip?: boolean;
  /** When true, the bottom (Extra Dokter) strip is not rendered. */
  hideBottomStrip?: boolean;
  /** Optional: when set, shift blocks are clickable (e.g. for voorkeuren). */
  onShiftClick?: (block: ShiftBlockView, position: { top: number; left: number }) => void;
  /** Optional: shiftKey -> chip code for pending preference inserts. */
  pendingInsert?: Map<string, string>;
  /** Optional: shiftKeys marked for preference removal (Weghalen). */
  pendingDelete?: Set<string>;
  /** Optional: resolve chip code to definition for rendering on blocks. */
  getChipByCode?: (code: string) => ChipDefinition | undefined;
  /** When false, preference UI on shift blocks is hidden. Default true. */
  showPreferences?: boolean;
  /** When set, renders voorkeur blocks per user below the shift lane (secretaris view). */
  voorkeuren?: VoorkeurItem[];
  /** When true, main shift blocks use icon-only filled preference styling (see CalendarGrid). */
  hidePreferenceFillInitialsOnShiftBlocks?: boolean;
  /** Click-and-drag preference assign on middle strips (see CalendarGrid). */
  enablePreferencePaintAssign?: boolean;
  onPreferencePaintSessionStart?: () => void;
  onPreferencePaintSessionEnd?: () => void;
  /**
   * When set, each stripe (top/middle/bottom) is individually clickable for the planning view.
   */
  onSectionShiftClick?: (block: ShiftBlockView, section: ShiftBlockSection) => void;
  /**
   * Preference preview for the currently selected planner doctor.
   * Key: "${van}_${tot}", value: ChipDefinition shown on the shift block.
   */
  plannerDoctorPreferenceMap?: Map<string, ChipDefinition>;
  /** Optional: when set, each shift block shows a delete button that calls this with the block. */
  onShiftDelete?: (block: ShiftBlockView) => void;
  /** Optional: public holidays / vakanties (e.g. from useCalendarVakanties). */
  vakanties?: CalendarVakantieItem[];
}

/**
 * Calendar grid with internal month/year state and navigation.
 * Use this when you don't need to control the view from outside.
 * Pass viewMonth, viewYear and onViewMonthChange to control the view from the parent.
 */
export function CalendarGridWithNavState({
  rows,
  shiftBlocks,
  initialViewMonth = 2,
  initialViewYear = 2025,
  viewMonth: controlledViewMonth,
  viewYear: controlledViewYear,
  onViewMonthChange,
  hideTopStrip,
  hideBottomStrip,
  onShiftClick,
  pendingInsert,
  pendingDelete,
  getChipByCode,
  showPreferences,
  voorkeuren,
  hidePreferenceFillInitialsOnShiftBlocks,
  enablePreferencePaintAssign,
  onPreferencePaintSessionStart,
  onPreferencePaintSessionEnd,
  onSectionShiftClick,
  plannerDoctorPreferenceMap,
  onShiftDelete,
  vakanties,
}: CalendarGridWithNavStateProps) {
  const [internalViewMonth, setInternalViewMonth] = useState(initialViewMonth);
  const [internalViewYear, setInternalViewYear] = useState(initialViewYear);

  const isControlled =
    controlledViewMonth !== undefined &&
    controlledViewYear !== undefined &&
    onViewMonthChange !== undefined;

  const viewMonth = isControlled ? controlledViewMonth : internalViewMonth;
  const viewYear = isControlled ? controlledViewYear : internalViewYear;

  const handleViewMonthChange = (month: number, year: number) => {
    if (isControlled) {
      onViewMonthChange(month, year);
    } else {
      setInternalViewMonth(month);
      setInternalViewYear(year);
    }
  };

  return (
    <CalendarGrid
      rows={rows}
      shiftBlocks={shiftBlocks}
      viewMonth={viewMonth}
      viewYear={viewYear}
      onViewMonthChange={handleViewMonthChange}
      hideTopStrip={hideTopStrip}
      hideBottomStrip={hideBottomStrip}
      onShiftClick={onShiftClick}
      pendingInsert={pendingInsert}
      pendingDelete={pendingDelete}
      getChipByCode={getChipByCode}
      showPreferences={showPreferences}
      voorkeuren={voorkeuren}
      hidePreferenceFillInitialsOnShiftBlocks={hidePreferenceFillInitialsOnShiftBlocks}
      enablePreferencePaintAssign={enablePreferencePaintAssign}
      onPreferencePaintSessionStart={onPreferencePaintSessionStart}
      onPreferencePaintSessionEnd={onPreferencePaintSessionEnd}
      onSectionShiftClick={onSectionShiftClick}
      plannerDoctorPreferenceMap={plannerDoctorPreferenceMap}
      onShiftDelete={onShiftDelete}
      vakanties={vakanties}
    />
  );
}
