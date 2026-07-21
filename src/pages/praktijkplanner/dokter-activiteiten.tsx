'use client';

import Head from 'next/head';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CAPACITY_WEEKDAYS } from '@/components/praktijkplanner/CapacityWeekGrid';
import { PraktijkplannerPage, type PraktijkplannerPageContext } from '@/components/praktijkplanner/PraktijkplannerPage';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { addDays, formatIsoDate, startOfIsoWeek } from '@/lib/praktijkplanner/dates';

type ReportRow = {
  id: string;
  soort: 'activiteit' | 'specificatie' | 'taak';
  label: string;
  kleur: string | null;
  cellen: Record<string, number>;
  totaal: number;
  datums: string[];
};

function participantName(participant: PraktijkplannerPageContext['data']['participants'][number]) {
  return (
    [participant.voornaam, participant.achternaam].filter(Boolean).join(' ') ||
    participant.name ||
    participant.initialen ||
    `Deelnemer ${participant.id}`
  );
}

function defaultStart() {
  return startOfIsoWeek(formatIsoDate(new Date()));
}

function formatReportDate(isoDate: string) {
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00`));
}

const ALL_PARTICIPANTS = 'all';

function sortRows(left: ReportRow, right: ReportRow) {
  return left.label.localeCompare(right.label, 'nl');
}

function RowDatesDropdown({ datums }: { datums: string[] }) {
  if (datums.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex size-6 shrink-0 items-center justify-center rounded border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={datums.length === 1 ? '1 datum tonen' : `${datums.length} datums tonen`}
      >
        <ChevronDown className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2" sideOffset={6}>
        <PopoverHeader className="px-1.5 pb-1">
          <PopoverTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {datums.length === 1 ? '1 datum' : `${datums.length} datums`}
          </PopoverTitle>
          <PopoverDescription className="sr-only">
            Datums waarop deze regel is toegekend in het geselecteerde tijdvak.
          </PopoverDescription>
        </PopoverHeader>
        <ul className="max-h-64 overflow-y-auto py-0.5">
          {datums.map((datum) => (
            <li key={datum} className="px-1.5 py-1 text-sm text-foreground">
              {formatReportDate(datum)}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function DoctorActivitiesContent({ groupId, data }: PraktijkplannerPageContext) {
  const [participantSelection, setParticipantSelection] = useState<number | typeof ALL_PARTICIPANTS>(
    () => (data.isManager ? ALL_PARTICIPANTS : (data.participants[0]?.id ?? ALL_PARTICIPANTS))
  );
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(() => addDays(defaultStart(), 6));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const effectiveParticipantParam = data.isManager
    ? participantSelection
    : (data.participants[0]?.id ?? null);

  const load = useCallback(() => {
    if (effectiveParticipantParam == null) return;
    const abortController = new AbortController();
    setLoading(true);
    fetch(
      `/api/praktijkplanner/rapportages/activiteiten?idwaarneemgroep=${groupId}&iddeelnemer=${effectiveParticipantParam}&start=${start}&end=${end}`,
      { credentials: 'include', signal: abortController.signal }
    )
      .then(async (response) => {
        const payload = (await response.json()) as { rows?: ReportRow[]; error?: string };
        if (!response.ok || !payload.rows) throw new Error(payload.error || 'De telling kon niet worden geladen.');
        return payload.rows;
      })
      .then((result) => {
        if (!abortController.signal.aborted) setRows(result);
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          setRows([]);
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false);
      });
    return () => abortController.abort();
  }, [effectiveParticipantParam, end, groupId, start]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const dayparts = useMemo(
    () => [...data.masterData.dayparts].sort((left, right) => left.volgorde - right.volgorde),
    [data.masterData.dayparts]
  );

  const activityRows = useMemo(
    () => rows.filter((row) => row.soort === 'activiteit' || row.soort === 'specificatie').sort(sortRows),
    [rows]
  );
  const taskRows = useMemo(() => rows.filter((row) => row.soort === 'taak').sort(sortRows), [rows]);

  const columnCount = 2 + CAPACITY_WEEKDAYS.length * dayparts.length;

  const renderSection = (title: string, sectionRows: ReportRow[], emptyLabel: string) => (
    <>
      <tr className="border-t bg-muted/30">
        <td colSpan={columnCount} className="sticky left-0 z-10 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </td>
      </tr>
      {sectionRows.map((row) => (
        <tr key={row.id} className="border-t">
          <td className="sticky left-0 z-10 border-r bg-card p-2 font-medium">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.kleur || '#64748b' }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              <RowDatesDropdown datums={row.datums ?? []} />
            </div>
          </td>
          {CAPACITY_WEEKDAYS.flatMap((weekday) =>
            dayparts.map((daypart) => (
              <td key={`${row.id}-${weekday.id}-${daypart.id}`} className="border-r p-1 text-center">
                {row.cellen[`${weekday.id}:${daypart.id}`] ?? ''}
              </td>
            ))
          )}
          <td className="p-2 text-right font-semibold">{row.totaal}</td>
        </tr>
      ))}
      {sectionRows.length === 0 && !loading ? (
        <tr className="border-t">
          <td colSpan={columnCount} className="p-4 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </td>
        </tr>
      ) : null}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
        {data.isManager ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Deelnemer</span>
            <select
              value={effectiveParticipantParam ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setParticipantSelection(value === ALL_PARTICIPANTS ? ALL_PARTICIPANTS : Number(value));
              }}
              className="h-9 rounded border bg-background px-2"
            >
              <option value={ALL_PARTICIPANTS}>Alle deelnemers</option>
              {data.participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participantName(participant)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Van</span>
          <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="h-9 rounded border bg-background px-2" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Tot</span>
          <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="h-9 rounded border bg-background px-2" />
        </label>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Telling laden…</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th rowSpan={2} className="sticky left-0 z-10 min-w-44 border-r bg-muted/40 p-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                Naam
              </th>
              {CAPACITY_WEEKDAYS.map((weekday) => (
                <th key={weekday.id} colSpan={dayparts.length} className="border-r p-2 text-center">
                  {weekday.label}
                </th>
              ))}
              <th rowSpan={2} className="p-2 text-right">
                Totaal
              </th>
            </tr>
            <tr>
              {CAPACITY_WEEKDAYS.flatMap((weekday) =>
                dayparts.map((daypart) => (
                  <th key={`${weekday.id}-${daypart.id}`} className="min-w-8 border-r p-1 text-center font-medium text-muted-foreground">
                    {daypart.naam.slice(0, 1)}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {renderSection('Activiteiten', activityRows, 'Geen activiteiten in dit tijdvak.')}
            {renderSection('Taken', taskRows, 'Geen taken in dit tijdvak.')}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DokterActiviteitenPage() {
  return (
    <>
      <Head>
        <title>Capaciteits rapportage | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage
        title="Capaciteits rapportage"
        description="Bekijk de telling van activiteiten en taken per weekdag en dagdeel."
      >
        {(context) => <DoctorActivitiesContent {...context} />}
      </PraktijkplannerPage>
    </>
  );
}
