import type { VakantieItem as RoosterVakantieItem } from './rooster';

/** Holiday row from GET /api/vakanties (unix van/tot in seconds). */
export type ApiVakantiePeriod = {
  naam: string;
  van: number;
  tot: number;
};

/** Entries the calendar can expand into day labels (rooster API or vakanties DB API). */
export type CalendarVakantieItem = RoosterVakantieItem | ApiVakantiePeriod;

export function isApiVakantiePeriod(v: CalendarVakantieItem): v is ApiVakantiePeriod {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as ApiVakantiePeriod).van === 'number' &&
    typeof (v as ApiVakantiePeriod).tot === 'number' &&
    typeof (v as ApiVakantiePeriod).naam === 'string'
  );
}

export function isRoosterVakantieItem(v: CalendarVakantieItem): v is RoosterVakantieItem {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as RoosterVakantieItem).current_date === 'string' &&
    typeof (v as RoosterVakantieItem).next_date === 'string' &&
    typeof (v as RoosterVakantieItem).naam === 'string'
  );
}
