'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS_NL = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];
const WEEKDAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Parse "YYYY-MM-DDTHH:MM" → parts. */
function parseValue(v: string) {
  if (!v || v.length < 16) return null;
  const year = parseInt(v.slice(0, 4), 10);
  const month = parseInt(v.slice(5, 7), 10) - 1; // 0-based
  const day = parseInt(v.slice(8, 10), 10);
  const hours = parseInt(v.slice(11, 13), 10);
  const minutes = parseInt(v.slice(14, 16), 10);
  if ([year, month, day, hours, minutes].some(isNaN)) return null;
  return { year, month, day, hours, minutes };
}

/** Format parts → "YYYY-MM-DDTHH:MM". */
function formatValue(year: number, month: number, day: number, hours: number, minutes: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
}

/** Build calendar grid rows (each row = 7 days, Mon–Sun). Includes overflow days from prev/next month. */
function buildGrid(year: number, month: number): { day: number; month: number; year: number }[][] {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const offset = firstDow === 0 ? 6 : firstDow - 1; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: { day: number; month: number; year: number }[] = [];

  // Prev-month fill
  for (let i = offset - 1; i >= 0; i--) {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ day: daysInPrev - i, month: m, year: y });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year });
  }
  // Next-month fill
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    cells.push({ day: d, month: m, year: y });
  }

  const rows: typeof cells[] = [];
  for (let r = 0; r < 6; r++) rows.push(cells.slice(r * 7, r * 7 + 7));
  return rows;
}

export interface DateTimePickerProps {
  value: string; // "YYYY-MM-DDTHH:MM"
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

export function DateTimePicker({ value, onChange, disabled, id }: DateTimePickerProps) {
  const parsed = parseValue(value);

  const [open, setOpen] = useState(false);
  const [navYear, setNavYear] = useState(parsed?.year ?? new Date().getFullYear());
  const [navMonth, setNavMonth] = useState(parsed?.month ?? new Date().getMonth());
  const [rawTime, setRawTime] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync calendar nav when value changes externally
  useEffect(() => {
    const p = parseValue(value);
    if (p) {
      setNavYear(p.year);
      setNavMonth(p.month);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const handleDayClick = useCallback(
    (day: number, month: number, year: number) => {
      const p = parseValue(value);
      const hours = p?.hours ?? 0;
      const minutes = p?.minutes ?? 0;
      onChange(formatValue(year, month, day, hours, minutes));
      setNavYear(year);
      setNavMonth(month);
    },
    [value, onChange]
  );

  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Update the display immediately; only commit to onChange when we have a valid HH:MM
      const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
      if (!match) {
        // Keep raw text in a local state until valid — we do this via the controlled value
        // For now store the raw string so the user can keep typing
        setRawTime(raw);
        return;
      }
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (h > 23 || m > 59) { setRawTime(raw); return; }
      setRawTime(null);
      const p = parseValue(value);
      const year = p?.year ?? new Date().getFullYear();
      const month = p?.month ?? new Date().getMonth();
      const day = p?.day ?? new Date().getDate();
      onChange(formatValue(year, month, day, h, m));
    },
    [value, onChange]
  );

  const prevMonth = useCallback(() => {
    if (navMonth === 0) { setNavMonth(11); setNavYear((y) => y - 1); }
    else setNavMonth((m) => m - 1);
  }, [navMonth]);

  const nextMonth = useCallback(() => {
    if (navMonth === 11) { setNavMonth(0); setNavYear((y) => y + 1); }
    else setNavMonth((m) => m + 1);
  }, [navMonth]);

  const grid = buildGrid(navYear, navMonth);
  const today = new Date();

  const displayDate = parsed
    ? `${pad(parsed.day)}-${pad(parsed.month + 1)}-${parsed.year}  ${pad(parsed.hours)}:${pad(parsed.minutes)}`
    : 'DD-MM-JJJJ  UU:MM';

  const timeValue = rawTime ?? (parsed ? `${pad(parsed.hours)}:${pad(parsed.minutes)}` : '');

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !parsed && 'text-muted-foreground'
        )}
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left tabular-nums">{displayDate}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-background p-3 shadow-md">
          {/* Month navigation */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
              aria-label="Vorige maand"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-medium capitalize">
              {MONTHS_NL[navMonth]} {navYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
              aria-label="Volgende maand"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-0.5 text-[11px] font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {grid.flat().map((cell, i) => {
              const isCurrentMonth = cell.month === navMonth && cell.year === navYear;
              const isSelected =
                parsed &&
                cell.day === parsed.day &&
                cell.month === parsed.month &&
                cell.year === parsed.year;
              const isToday =
                cell.day === today.getDate() &&
                cell.month === today.getMonth() &&
                cell.year === today.getFullYear();

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDayClick(cell.day, cell.month, cell.year)}
                  className={cn(
                    'rounded py-1 text-center text-xs transition-colors hover:bg-muted',
                    !isCurrentMonth && 'text-muted-foreground/50',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                    isToday && !isSelected && 'font-semibold text-primary'
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Time input */}
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <span className="shrink-0 text-xs text-muted-foreground">Tijd (UU:MM)</span>
            <input
              type="text"
              value={timeValue}
              onChange={handleTimeChange}
              placeholder="08:00"
              maxLength={5}
              className={cn(
                'w-16 rounded-md border border-input bg-transparent px-2 py-0.5 text-sm tabular-nums outline-none',
                'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
