import { useEffect, useMemo, useState } from 'react';
import { addDays, formatIsoDate } from '@/lib/praktijkplanner/dates';

type LegacyHoliday = {
  naam: string;
  van: number;
  tot: number;
  type: number;
};

export type PlannerHolidayData = {
  labels: ReadonlyMap<string, string[]>;
  publicHolidayDates: ReadonlySet<string>;
};

function yearsForRange(start: string, end: string): number[] {
  const years = new Set<number>();
  for (let date = start; date <= end; date = addDays(date, 1)) {
    years.add(Number(date.slice(0, 4)));
  }
  return [...years];
}

export function usePlannerHolidayData(start: string, end: string): PlannerHolidayData {
  const [holidays, setHolidays] = useState<LegacyHoliday[]>([]);
  const years = useMemo(() => yearsForRange(start, end), [end, start]);
  const yearKey = years.join(',');

  useEffect(() => {
    const abortController = new AbortController();
    const requestedYears = yearKey
      .split(',')
      .map(Number)
      .filter((year) => Number.isInteger(year));
    Promise.all(
      requestedYears.map(async (year) => {
        const response = await fetch(`/api/vakanties?year=${year}`, {
          credentials: 'include',
          signal: abortController.signal,
        });
        if (!response.ok) return [];
        const payload = (await response.json()) as { vakanties?: LegacyHoliday[] };
        return payload.vakanties ?? [];
      })
    )
      .then((results) => {
        if (!abortController.signal.aborted) setHolidays(results.flat());
      })
      .catch(() => {
        if (!abortController.signal.aborted) setHolidays([]);
      });
    return () => abortController.abort();
  }, [yearKey]);

  return useMemo(() => {
    const labels = new Map<string, string[]>();
    const publicHolidayDates = new Set<string>();
    for (const holiday of holidays) {
      const holidayStart = formatIsoDate(new Date(holiday.van * 1000));
      const holidayEnd = formatIsoDate(new Date(holiday.tot * 1000));
      const startDate = holidayStart < start ? start : holidayStart;
      const endDate = holidayEnd > end ? end : holidayEnd;
      for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
        if (holiday.naam) {
          const values = labels.get(date) ?? [];
          values.push(holiday.naam);
          labels.set(date, values);
        }
        if (holiday.type === 0) publicHolidayDates.add(date);
      }
    }
    return { labels, publicHolidayDates };
  }, [end, holidays, start]);
}

export function usePlannerHolidays(start: string, end: string) {
  return usePlannerHolidayData(start, end).labels;
}
