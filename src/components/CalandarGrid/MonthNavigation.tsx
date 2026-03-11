import { useRef, useState, useEffect } from 'react';
import { MONTH_SHORT } from '@/utils/calendarUtils';
import { MonthPicker } from '@/components/ui/monthpicker';

function formatMonthYear(m: number, y: number): string {
  const label = MONTH_SHORT[m];
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return `${capitalized} ${y}`;
}

const ArrowLeft = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L6.84 8l2.94 2.72a.75.75 0 1 1-1.04 1.08l-3.5-3.25a.75.75 0 0 1 0-1.08l3.5-3.25a.75.75 0 0 1 1.04 1.06Z" clipRule="evenodd" />
  </svg>
);

const ArrowRight = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.5 3.25a.75.75 0 0 1 0 1.08l-3.5 3.25a.75.75 0 0 1-1.04-1.08L9.16 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
  </svg>
);

export interface MonthNavigationProps {
  month: number;
  year: number;
  onSelectMonth: (month: number, year: number) => void;
}

export function MonthNavigation({ month, year, onSelectMonth }: MonthNavigationProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerWrapperRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerWrapperRef.current && !pickerWrapperRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  const prevMonth = (offset: number) => {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() - offset);
    return { month: d.getMonth(), year: d.getFullYear() };
  };
  const nextMonth = (offset: number) => {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() + offset);
    return { month: d.getMonth(), year: d.getFullYear() };
  };

  const navItems: { month: number; year: number }[] = [
    prevMonth(4),
    prevMonth(3),
    prevMonth(2),
    prevMonth(1),
  ];
  const nextItems: { month: number; year: number }[] = [
    nextMonth(1),
    nextMonth(2),
    nextMonth(3),
    nextMonth(4),
  ];

  return (
    <div className="flex justify-center min-w-0">
      <nav className="flex items-center min-w-0" aria-label="Maandnavigatie">
        <ul className="list-none flex flex-wrap items-center justify-center gap-y-2 gap-x-4 p-0 m-0">
          {navItems.map(({ month: m, year: y }) => (
            <li key={`${y}-${m}`} className="list-none p-0">
              <button
                type="button"
                className="bg-transparent border-none py-1 font-inherit text-gray-500 font-normal underline underline-offset-2 decoration-gray-300 cursor-pointer transition-colors duration-150 hover:text-gray-700"
                onClick={() => onSelectMonth(m, y)}
                aria-label={`Ga naar ${formatMonthYear(m, y)}`}
              >
                {formatMonthYear(m, y)}
              </button>
            </li>
          ))}
          <li className="list-none p-0">
            <button
              type="button"
              className="bg-transparent border-none py-1 px-2 cursor-pointer text-gray-800 flex items-center justify-center hover:opacity-80 transition-opacity"
              onClick={() => {
                const p = prevMonth(1);
                onSelectMonth(p.month, p.year);
              }}
              aria-label="Vorige maand"
            >
              <ArrowLeft />
            </button>
          </li>
          <li className="list-none p-0 relative" ref={pickerWrapperRef}>
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              className="font-bold text-gray-800 text-[1.05em] px-1 no-underline bg-transparent border-none cursor-pointer hover:opacity-80 transition-opacity"
              data-month={month}
              data-year={year}
              aria-label="Kies maand en jaar"
              aria-expanded={pickerOpen}
              aria-haspopup="dialog"
            >
              {formatMonthYear(month, year)}
            </button>
            {pickerOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white rounded-lg border border-gray-200 shadow-lg">
                <MonthPicker
                  selectedMonth={new Date(year, month, 1)}
                  onMonthSelect={(date) => {
                    onSelectMonth(date.getMonth(), date.getFullYear());
                    setPickerOpen(false);
                  }}
                  callbacks={{
                    monthLabel: (m) => {
                      const name = MONTH_SHORT[m.number];
                      return name.charAt(0).toUpperCase() + name.slice(1);
                    },
                  }}
                />
              </div>
            )}
          </li>
          <li className="list-none p-0">
            <button
              type="button"
              className="bg-transparent border-none py-1 px-2 cursor-pointer text-gray-800 flex items-center justify-center hover:opacity-80 transition-opacity"
              onClick={() => {
                const n = nextMonth(1);
                onSelectMonth(n.month, n.year);
              }}
              aria-label="Volgende maand"
            >
              <ArrowRight />
            </button>
          </li>
          {nextItems.map(({ month: m, year: y }) => (
            <li key={`${y}-${m}`} className="list-none p-0">
              <button
                type="button"
                className="bg-transparent border-none py-1 font-inherit text-gray-500 font-normal underline underline-offset-2 decoration-gray-300 cursor-pointer transition-colors duration-150 hover:text-gray-700"
                onClick={() => onSelectMonth(m, y)}
                aria-label={`Ga naar ${formatMonthYear(m, y)}`}
              >
                {formatMonthYear(m, y)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
