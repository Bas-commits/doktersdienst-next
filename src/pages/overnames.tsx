'use client';

import Head from 'next/head';
import { useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { CalendarGridWithNavState } from '@/components/CalandarGrid/CalendarGridWithNavState';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { dienstenToShiftBlocks, groupShiftBlocksByWaarneemgroep, withWaarneemgroepNames } from '@/hooks/useDienstenSchedule';
import { useDienstenSubscription } from '@/hooks/useDienstenSubscription';

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

export default function OvernamesPage() {
  const { data: session } = authClient.useSession();
  const name = session?.user?.name ?? session?.user?.email ?? 'daar';

  const now = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const { waarneemgroepen, loading: waarneemgroepenLoading, error: waarneemgroepenError } = useWaarneemgroep();
  const waarneemgroepIds = useMemo(() => {
    if (!waarneemgroepen?.length) return [];
    return waarneemgroepen.map((wg) => wg.ID).filter((id): id is number => id != null && !Number.isNaN(id));
  }, [waarneemgroepen]);
  /** Name source for calendar rows: context uses ID/naam, schedule helpers expect id/naam. */
  const waarneemgroepNameSource = useMemo(
    () => (waarneemgroepen?.length ? waarneemgroepen.map((w) => ({ id: w.ID, naam: w.naam })) : null),
    [waarneemgroepen]
  );

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
    return withWaarneemgroepNames(groupShiftBlocksByWaarneemgroep(blocks), waarneemgroepNameSource);
  }, [dienstenResponse, waarneemgroepNameSource]);

  const loading = waarneemgroepenLoading || (waarneemgroepIds.length > 0 && dienstenLoading);
  const error = waarneemgroepenError ?? dienstenError;

  return (
    <>
      <Head>
        <title>Overnames | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 id="overnames-heading" className="text-2xl font-semibold tracking-tight">
                Overnames
              </h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Overzicht van openstaande diensten (nog niet toegewezen). Welkom, {name}.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Openstaande diensten</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 text-destructive" role="alert">
                {error}
              </p>
            )}
            {loading && !dienstenResponse && (
              <p className="mb-4 text-muted-foreground">Overnames laden…</p>
            )}
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
          </CardContent>
        </Card>
      </div>
    </>
  );
}
