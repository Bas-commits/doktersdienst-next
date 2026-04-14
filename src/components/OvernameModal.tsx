import { useRef, useState } from 'react';
import { ChevronDownIcon, Clock, CalendarIcon } from 'lucide-react';
import { format, isBefore, isAfter, startOfDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { ShiftBlockView } from '@/types/diensten';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { TimePickerInput } from '@/components/ui/time-picker-input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export interface OvernameDoctor {
  id: number;
  voornaam: string;
  achternaam: string;
  initialen?: string;
  color?: string;
}

function DoctorBadge({ doctor, size = 'sm' }: { doctor: OvernameDoctor; size?: 'sm' | 'md' }) {
  const initials = doctor.initialen ?? `${doctor.voornaam[0] ?? ''}${doctor.achternaam[0] ?? ''}`.toUpperCase();
  const bg = doctor.color ?? '#6b7280';
  const px = size === 'md' ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]';
  return (
    <span
      className={`inline-flex items-center justify-center rounded font-semibold text-white shrink-0 ${px}`}
      style={{ backgroundColor: bg }}
    >
      {initials}
    </span>
  );
}

export interface OvernameModalProps {
  shift: ShiftBlockView;
  doctors: OvernameDoctor[];
  onSubmit: (data: { iddeelnovern: number; van: number; tot: number; isPartial: boolean }) => void;
  onClose: () => void;
  submitting?: boolean;
  error?: string | null;
}

function dateToUnix(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

function applyCalendarDate(target: Date, calDate: Date): Date {
  const d = new Date(target);
  d.setFullYear(calDate.getFullYear(), calDate.getMonth(), calDate.getDate());
  return d;
}

// Defined at module level — prevents remount (and awaitSecond reset) on parent re-render.
function TimeRow({
  label,
  date,
  isDateDisabled,
  onTimeChange,
  onDatePick,
  hourRef,
  minuteRef,
  nextRef,
}: {
  label: string;
  date: Date;
  isDateDisabled: (d: Date) => boolean;
  onTimeChange: (d: Date | undefined) => void;
  onDatePick: (d: Date | undefined) => void;
  hourRef: React.RefObject<HTMLInputElement | null>;
  minuteRef: React.RefObject<HTMLInputElement | null>;
  nextRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-end gap-2">
        <Popover>
          <PopoverTrigger className="inline-flex items-center gap-1.5 h-10 px-2.5 text-sm border border-input rounded-md bg-background hover:bg-accent cursor-pointer">
            <CalendarIcon className="size-3.5 text-muted-foreground" />
            <span>{format(date, 'd MMM', { locale: nl })}</span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" side="bottom" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={onDatePick}
              disabled={isDateDisabled}
              locale={nl}
              defaultMonth={date}
            />
          </PopoverContent>
        </Popover>

        <div className="flex items-end gap-1">
          <div className="grid gap-1 text-center">
            <span className="text-[10px] text-gray-400">uu</span>
            <TimePickerInput
              picker="hours"
              date={date}
              setDate={onTimeChange}
              ref={hourRef}
              onRightFocus={() => minuteRef.current?.focus()}
            />
          </div>
          <span className="pb-2 text-gray-400 font-medium">:</span>
          <div className="grid gap-1 text-center">
            <span className="text-[10px] text-gray-400">mm</span>
            <TimePickerInput
              picker="minutes"
              date={date}
              setDate={onTimeChange}
              ref={minuteRef}
              onLeftFocus={() => hourRef.current?.focus()}
              onRightFocus={nextRef ? () => nextRef.current?.focus() : undefined}
            />
          </div>
          <div className="flex h-10 items-center pb-0.5">
            <Clock className="ml-1 h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function OvernameModal({ shift, doctors, onSubmit, onClose, submitting, error }: OvernameModalProps) {
  const [selectedDoctor, setSelectedDoctor] = useState<number | ''>('');
  const [isPartial, setIsPartial] = useState(false);

  const shiftStartDate = new Date(shift.van * 1000);
  const shiftEndDate   = new Date(shift.tot * 1000);

  const [partialStart, setPartialStart] = useState<Date>(() => {
    const [h, m] = shift.startTime.split(':').map(Number);
    const d = new Date(shiftStartDate);
    d.setHours(h, m, 0, 0);
    return d;
  });
  const [partialEnd, setPartialEnd] = useState<Date>(() => {
    const [h, m] = shift.endTime.split(':').map(Number);
    const d = new Date(shiftEndDate);
    d.setHours(h, m, 0, 0);
    return d;
  });

  const [timeError, setTimeError]         = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const startHourRef   = useRef<HTMLInputElement>(null);
  const startMinuteRef = useRef<HTMLInputElement>(null);
  const endHourRef     = useRef<HTMLInputElement>(null);
  const endMinuteRef   = useRef<HTMLInputElement>(null);

  const startDateStr = shiftStartDate.toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const endDateStr = shiftEndDate.toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  function isDateDisabled(date: Date): boolean {
    return (
      isBefore(startOfDay(date), startOfDay(shiftStartDate)) ||
      isAfter(startOfDay(date),  startOfDay(shiftEndDate))
    );
  }

  function validateTimes(start: Date, end: Date): string | null {
    const van = dateToUnix(start);
    const tot = dateToUnix(end);
    if (van < shift.van) return 'Starttijd valt voor het begin van de dienst';
    if (tot > shift.tot) return 'Eindtijd valt na het einde van de dienst';
    if (van >= tot)      return 'Starttijd moet voor eindtijd liggen';
    return null;
  }

  function handleStartChange(d: Date | undefined) {
    if (!d) return;
    setPartialStart(d);
    setTimeError(validateTimes(d, partialEnd));
  }

  function handleEndChange(d: Date | undefined) {
    if (!d) return;
    setPartialEnd(d);
    setTimeError(validateTimes(partialStart, d));
  }

  function handleSubmit() {
    setValidationError(null);
    if (!selectedDoctor) { setValidationError('Selecteer een arts'); return; }

    let van = shift.van;
    let tot = shift.tot;

    if (isPartial) {
      if (timeError) { setValidationError(timeError); return; }
      van = dateToUnix(partialStart);
      tot = dateToUnix(partialEnd);
      if (van < shift.van || tot > shift.tot) {
        setValidationError('Tijdvenster moet binnen de oorspronkelijke dienst vallen');
        return;
      }
      if (van >= tot) { setValidationError('Starttijd moet voor eindtijd liggen'); return; }
    }

    onSubmit({ iddeelnovern: Number(selectedDoctor), van, tot, isPartial });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Overname voorstel</h2>

        <div className="bg-gray-50 rounded-md p-3 mb-4 text-sm">
          <p className="font-medium">
            Van: {startDateStr} <strong>{shift.startTime}</strong>
            <br />
            Tot: {endDateStr} <strong>{shift.endTime}</strong>
          </p>
          {shift.middle && (
            <p className="text-gray-600 mt-2">
              Van: {shift.middle.name} ({shift.middle.shortName})
            </p>
          )}
        </div>

        <label className="block text-sm font-medium mb-1">Naar:</label>
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 mb-4 text-sm text-left bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {selectedDoctor ? (() => {
              const doc = doctors.find((d) => d.id === selectedDoctor);
              return doc ? (
                <>
                  <DoctorBadge doctor={doc} />
                  <span className="flex-1">{doc.voornaam} {doc.achternaam}</span>
                </>
              ) : null;
            })() : (
              <span className="flex-1 text-gray-400">Selecteer een arts…</span>
            )}
            <ChevronDownIcon className="size-4 text-gray-400 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {doctors.filter((doc) => doc.id !== shift.middle?.id).map((doc) => (
              <DropdownMenuItem
                key={doc.id}
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setSelectedDoctor(doc.id)}
              >
                <DoctorBadge doctor={doc} size="md" />
                <span>{doc.voornaam} {doc.achternaam}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <label className="flex items-center gap-2 mb-4 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isPartial}
            onChange={(e) => setIsPartial(e.target.checked)}
            className="rounded border-gray-300"
          />
          Deels overname
        </label>

        {isPartial && (
          <div className="mb-4">
            <div className="flex gap-6 flex-wrap">
              <TimeRow
                label="Van"
                date={partialStart}
                isDateDisabled={isDateDisabled}
                onTimeChange={handleStartChange}
                onDatePick={(d) => d && handleStartChange(applyCalendarDate(partialStart, d))}
                hourRef={startHourRef}
                minuteRef={startMinuteRef}
                nextRef={endHourRef}
              />
              <TimeRow
                label="Tot"
                date={partialEnd}
                isDateDisabled={isDateDisabled}
                onTimeChange={handleEndChange}
                onDatePick={(d) => d && handleEndChange(applyCalendarDate(partialEnd, d))}
                hourRef={endHourRef}
                minuteRef={endMinuteRef}
              />
            </div>
            {timeError && <p className="text-red-600 text-xs mt-2">{timeError}</p>}
          </div>
        )}

        {(validationError || error) && (
          <p className="text-red-600 text-sm mb-4">{validationError || error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={onClose}
            disabled={submitting}
          >
            Annuleren
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Bezig…' : 'Voorstel indienen'}
          </button>
        </div>
      </div>
    </div>
  );
}
