'use client';

import Head from 'next/head';
import { useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { CalendarGridWithNavState } from '@/components/CalandarGrid/CalendarGridWithNavState';
import { dienstenToShiftBlocks, groupShiftBlocksByWaarneemgroep } from '@/hooks/useDienstenSchedule';
import { useDienstenSubscription } from '@/hooks/useDienstenSubscription';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';

const TWO_WEEKS_SECONDS = 14 * 24 * 60 * 60;

/** Unix seconds for start of first day of month (0-based), minus 2 weeks so adjacent visible days have data. */
function vanGteForMonth(viewMonth: number, viewYear: number): number {
  return Math.floor(new Date(viewYear, viewMonth, 1, 0, 0, 0, 0).getTime() / 1000) - TWO_WEEKS_SECONDS;
}

/** Unix seconds for end of last day of month (23:59:59), plus 2 weeks so adjacent visible days have data. */
function totLteForMonth(viewMonth: number, viewYear: number): number {
  return Math.floor(new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999).getTime() / 1000) + TWO_WEEKS_SECONDS;
}

/** Type 1 = unassigned slot (no one assigned yet). */
const TYPE_UNASSIGNED_SLOT = 1;

export default function VoorkeurenPage() {
  const { data: session } = authClient.useSession();
  const name = session?.user?.name ?? session?.user?.email ?? 'daar';

  const { activeWaarneemgroepId, activeWaarneemgroep, loading: waarneemgroepContextLoading, error: waarneemgroepContextError } = useWaarneemgroep();

  const now = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  /** Only the selected waarneemgroep in the header (one at a time). */
  const waarneemgroepIds = useMemo(() => {
    if (!activeWaarneemgroepId) return [];
    const id = Number(activeWaarneemgroepId);
    return Number.isNaN(id) ? [] : [id];
  }, [activeWaarneemgroepId]);

  const vanGte = useMemo(() => vanGteForMonth(viewMonth, viewYear), [viewMonth, viewYear]);
  const totLte = useMemo(() => totLteForMonth(viewMonth, viewYear), [viewMonth, viewYear]);
  const { data: dienstenResponse, loading: dienstenLoading, error: dienstenError } = useDienstenSubscription(
    vanGte,
    totLte,
    waarneemgroepIds,
    [TYPE_UNASSIGNED_SLOT]
  );

  const rows = useMemo(() => {
    const blocks = dienstenToShiftBlocks(dienstenResponse ?? null);
    const grouped = groupShiftBlocksByWaarneemgroep(blocks);
    return grouped.map((row) => ({
      ...row,
      name: activeWaarneemgroep?.naam ?? row.name,
    }));
  }, [dienstenResponse, activeWaarneemgroep?.naam]);

  const loading = waarneemgroepContextLoading || (waarneemgroepIds.length > 0 && dienstenLoading);
  const error = waarneemgroepContextError ?? dienstenError;

  return (
    <>
      <Head>
        <title>Voorkeuren | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 id="voorkeuren-heading" className="text-2xl font-semibold tracking-tight">
                Voorkeuren
              </h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Openstaande diensten (type 1) voor de geselecteerde waarneemgroep in de header.
              {activeWaarneemgroep ? ` Huidige groep: ${activeWaarneemgroep.naam}.` : ' Selecteer een waarneemgroep in de header.'}
              {' '}Welkom, {name}.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              {activeWaarneemgroep ? `Openstaande diensten – ${activeWaarneemgroep.naam}` : 'Openstaande diensten'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 text-destructive" role="alert">
                {error}
              </p>
            )}
            {!activeWaarneemgroepId && !loading && (
              <p className="mb-4 text-muted-foreground">
                Selecteer een waarneemgroep in de header om openstaande diensten te zien.
              </p>
            )}
            {loading && !dienstenResponse && waarneemgroepIds.length > 0 && (
              <p className="mb-4 text-muted-foreground">Voorkeuren laden…</p>
            )}
            {waarneemgroepIds.length > 0 && (
              <CalendarGridWithNavState
                rows={rows}
                initialViewMonth={now.getMonth()}
                initialViewYear={now.getFullYear()}
                viewMonth={viewMonth}
                viewYear={viewYear}
                onViewMonthChange={(month, year) => {
                  setViewMonth(month);
                  setViewYear(year);
                }}
                hideTopStrip
                hideBottomStrip
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
