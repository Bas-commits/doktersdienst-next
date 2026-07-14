'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PraktijkplannerPage, type PraktijkplannerPageContext } from '@/components/praktijkplanner/PraktijkplannerPage';
import { addDays, formatIsoDate, startOfIsoWeek } from '@/lib/praktijkplanner/dates';

type ReportRow = {
  id: string;
  soort: 'activiteit' | 'specificatie' | 'taak';
  label: string;
  kleur: string | null;
  cellen: Record<string, number>;
  totaal: number;
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

function DoctorActivitiesContent({ groupId, data }: PraktijkplannerPageContext) {
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(() => addDays(defaultStart(), 6));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const effectiveParticipantId = participantId ?? data.participants[0]?.id ?? null;

  const load = useCallback(() => {
    if (!effectiveParticipantId) return;
    const abortController = new AbortController();
    setLoading(true);
    fetch(
      `/api/praktijkplanner/rapportages/activiteiten?idwaarneemgroep=${groupId}&iddeelnemer=${effectiveParticipantId}&start=${start}&end=${end}`,
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
  }, [effectiveParticipantId, end, groupId, start]);

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
  const dates = useMemo(() => {
    const values: string[] = [];
    for (let current = start; current <= end && values.length < 31; current = addDays(current, 1)) {
      values.push(current);
    }
    return values;
  }, [end, start]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
        {data.isManager ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Deelnemer</span>
            <select
              value={effectiveParticipantId ?? ''}
              onChange={(event) => setParticipantId(Number(event.target.value) || null)}
              className="h-9 rounded border bg-background px-2"
            >
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
              <th rowSpan={2} className="sticky left-0 z-10 min-w-40 border-r bg-muted/40 p-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                Activiteit / taak
              </th>
              {dates.map((date) => (
                <th key={date} colSpan={dayparts.length} className="border-r p-2 text-center">
                  {new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }).format(
                    new Date(`${date}T12:00:00`)
                  )}
                </th>
              ))}
              <th rowSpan={2} className="p-2 text-right">Totaal</th>
            </tr>
            <tr>
              {dates.flatMap((date) =>
                dayparts.map((daypart) => (
                  <th key={`${date}-${daypart.id}`} className="min-w-8 border-r p-1 text-center font-medium text-muted-foreground">
                    {daypart.naam.slice(0, 1)}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="sticky left-0 z-10 border-r bg-card p-2 font-medium">
                  <span
                    className="mr-1 inline-block size-2 rounded-full"
                    style={{ backgroundColor: row.kleur || '#64748b' }}
                    aria-hidden
                  />
                  {row.label}
                </td>
                {dates.flatMap((date) =>
                  dayparts.map((daypart) => (
                    <td key={`${row.id}-${date}-${daypart.id}`} className="border-r p-1 text-center">
                      {row.cellen[`${new Date(`${date}T12:00:00`).getDay() || 7}:${daypart.id}`] ?? ''}
                    </td>
                  ))
                )}
                <td className="p-2 text-right font-semibold">{row.totaal}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={2 + dates.length * dayparts.length} className="p-6 text-center text-sm text-muted-foreground">
                  Geen activiteiten of taken in dit tijdvak.
                </td>
              </tr>
            ) : null}
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
        <title>Dokter activity | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage
        title="Dokter activity"
        description="Bekijk de telling van activiteiten en taken per dagdeel."
      >
        {(context) => <DoctorActivitiesContent {...context} />}
      </PraktijkplannerPage>
    </>
  );
}
