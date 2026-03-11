import type { CalendarGridRow } from './CalendarGrid';
import type { ShiftBlockView, DoctorInfo } from '@/types/diensten';

/** Build a single ShiftBlockView for demo data (day/month 0-based). */
function makeBlock(
  id: number,
  day: number,
  month: number,
  year: number,
  startHour: number,
  endHour: number,
  middle: DoctorInfo | null,
  top?: DoctorInfo | null,
  bottom?: DoctorInfo | null
): ShiftBlockView {
  const pad = (n: number) => String(n).padStart(2, '0');
  const startTime = `${pad(startHour)}:00`;
  const endTime = `${pad(endHour)}:00`;
  const currentDate = `${year}-${pad(month + 1)}-${pad(day)} ${startTime}:00`;
  const nextDate = `${year}-${pad(month + 1)}-${pad(day)} ${endTime}:00`;
  const van = Math.floor(new Date(year, month, day, startHour).getTime() / 1000);
  const tot = Math.floor(new Date(year, month, day, endHour).getTime() / 1000);
  return {
    id,
    day,
    month,
    year,
    van,
    tot,
    startTime,
    endTime,
    currentDate,
    nextDate,
    middle,
    top: top ?? null,
    bottom: bottom ?? null,
    label: startHour < 12 ? 'Ochtend' : 'Avond',
  };
}

const doctorJan: DoctorInfo = { id: 1, name: 'Jan de Vries', shortName: 'JD', color: '#3b82f6' };
const doctorMarie: DoctorInfo = { id: 2, name: 'Marie Smith', shortName: 'MS', color: '#10b981' };
const doctorPieter: DoctorInfo = { id: 3, name: 'Pieter Kramer', shortName: 'PK', color: '#f59e0b' };
const doctorAnna: DoctorInfo = { id: 4, name: 'Anna Jansen', shortName: 'AJ', color: '#ec4899' };
const doctorTom: DoctorInfo = { id: 5, name: 'Tom Bakker', shortName: 'TB', color: '#06b6d4' };

/** Demo rows per waarneemgroep (March 2025). Use in stories or dev/demo pages. */
export const waarneemgroepRows: CalendarGridRow[] = [
  {
    id: 1,
    name: 'Waarneemgroep A',
    shiftBlocks: [
      makeBlock(101, 10, 2, 2025, 8, 16, doctorJan, doctorMarie, null),
      makeBlock(102, 12, 2, 2025, 9, 17, doctorMarie, null, doctorPieter),
      makeBlock(103, 14, 2, 2025, 8, 12, doctorJan, null, null),
    ],
  },
  {
    id: 2,
    name: 'Waarneemgroep B',
    shiftBlocks: [
      makeBlock(201, 11, 2, 2025, 8, 16, doctorPieter, null, doctorJan),
      makeBlock(202, 13, 2, 2025, 14, 22, doctorAnna, doctorTom, null),
      makeBlock(203, 15, 2, 2025, 8, 17, doctorTom, null, doctorAnna),
    ],
  },
  {
    id: 3,
    name: 'Waarneemgroep C',
    shiftBlocks: [
      makeBlock(301, 10, 2, 2025, 14, 22, doctorAnna, null, null),
      makeBlock(302, 17, 2, 2025, 8, 16, doctorTom, doctorJan, doctorMarie),
    ],
  },
];
