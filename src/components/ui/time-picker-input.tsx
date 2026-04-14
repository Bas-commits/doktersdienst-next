'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type TimePickerType = 'hours' | 'minutes' | 'seconds';

function getValueByType(date: Date | undefined, type: TimePickerType): string {
  if (!date) return '00';
  switch (type) {
    case 'hours':   return String(date.getHours()).padStart(2, '0');
    case 'minutes': return String(date.getMinutes()).padStart(2, '0');
    case 'seconds': return String(date.getSeconds()).padStart(2, '0');
  }
}

function setValueByType(date: Date | undefined, value: string, type: TimePickerType): Date {
  const d = date ? new Date(date) : new Date();
  const v = parseInt(value, 10);
  switch (type) {
    case 'hours':   d.setHours(v);   break;
    case 'minutes': d.setMinutes(v); break;
    case 'seconds': d.setSeconds(v); break;
  }
  return d;
}

function wrap(value: number, max: number): string {
  return String(((value % max) + max) % max).padStart(2, '0');
}

export interface TimePickerInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  picker: TimePickerType;
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  onRightFocus?: () => void;
  onLeftFocus?: () => void;
}

export const TimePickerInput = React.forwardRef<HTMLInputElement, TimePickerInputProps>(
  ({ className, picker, date, setDate, onRightFocus, onLeftFocus, ...props }, ref) => {
    // Flag tracks whether we're awaiting the second digit of a two-key entry
    const [awaitSecond, setAwaitSecond] = React.useState(false);

    const displayValue = getValueByType(date, picker);
    const max = picker === 'hours' ? 24 : 60;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Tab') return;
      e.preventDefault();

      if (e.key === 'ArrowRight') { onRightFocus?.(); return; }
      if (e.key === 'ArrowLeft')  { onLeftFocus?.();  return; }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        setAwaitSecond(false);
        const step = e.key === 'ArrowUp' ? 1 : -1;
        const cur = parseInt(displayValue, 10);
        setDate(setValueByType(date, wrap(cur + step, max), picker));
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        const digit = e.key;
        if (!awaitSecond) {
          // First digit: show "0X" and wait for second
          setDate(setValueByType(date, '0' + digit, picker));
          setAwaitSecond(true);
        } else {
          // Second digit: combine with previous tens
          const tens = displayValue[1]; // unit digit of current "0X"
          const combined = tens + digit;
          const numeric = parseInt(combined, 10);
          const clamped = Math.min(numeric, max - 1);
          setDate(setValueByType(date, String(clamped).padStart(2, '0'), picker));
          setAwaitSecond(false);
          onRightFocus?.(); // auto-advance
        }
        return;
      }
    };

    return (
      <input
        ref={ref}
        id={picker}
        className={cn(
          'w-12 h-10 text-center tabular-nums text-sm font-mono',
          'border border-input rounded-md bg-background',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          'caret-transparent select-none cursor-default',
          className,
        )}
        value={displayValue}
        onChange={() => { /* controlled via keydown */ }}
        onKeyDown={handleKeyDown}
        onBlur={() => setAwaitSecond(false)}
        readOnly
        {...props}
      />
    );
  }
);
TimePickerInput.displayName = 'TimePickerInput';
