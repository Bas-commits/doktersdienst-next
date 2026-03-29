'use client';

import Head from 'next/head';
import { useCallback, useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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

/** Selected waarneemgroep ids to show in the calendar. null = use header default (only active). */
function defaultSelectedIds(activeId: string | null, waarneemgroepIds: number[]): Set<number> {
  if (activeId) {
    const n = Number(activeId);
    if (!Number.isNaN(n)) return new Set([n]);
  }
  // Fall back to first waarneemgroep when no active selection exists (e.g. fresh session)
  if (waarneemgroepIds.length > 0) return new Set([waarneemgroepIds[0]]);
  return new Set();
}

export default function RoosterInzienPage() {
  const { data: session } = authClient.useSession();
  const name = session?.user?.name ?? session?.user?.email ?? 'daar';
  const { activeWaarneemgroepId, waarneemgroepen, loading: waarneemgroepenLoading, error: waarneemgroepenError } = useWaarneemgroep();

  const now = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  /** When null, effective selection is "only header-selected". When set, user has toggled checkboxes. */
  const [selectedIds, setSelectedIds] = useState<Set<number> | null>(null);

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
  // Only fetch assignment types — exclude preference types (2, 3, 10, 5001) and avoid
  // type=9 dual-meaning (Vakantie preference vs Extra Dokter assignment) leaking into shift blocks.
  const ASSIGNMENT_TYPES = useMemo(() => [0, 1, 4, 5, 6, 9, 11], []);

  const { data: dienstenResponse, loading: dienstenLoading, error: dienstenError } = useDienstenSubscription(
    vanGte,
    totLte,
    waarneemgroepIds,
    ASSIGNMENT_TYPES
  );

  const allRows = useMemo(() => {
    const blocks = dienstenToShiftBlocks(dienstenResponse ?? null);
    return groupShiftBlocksByWaarneemgroep(blocks);
  }, [dienstenResponse]);

  const idsToShow = useMemo(
    () => (selectedIds !== null ? selectedIds : defaultSelectedIds(activeWaarneemgroepId, waarneemgroepIds)),
    [selectedIds, activeWaarneemgroepId, waarneemgroepIds]
  );

  const rows = useMemo(
    () => withWaarneemgroepNames(
      allRows.filter((row) => idsToShow.has(row.id)),
      waarneemgroepNameSource
    ),
    [allRows, idsToShow, waarneemgroepNameSource]
  );

  const toggleWaarneemgroep = useCallback(
    (wgId: number, checked: boolean) => {
      setSelectedIds((prev) => {
        const base = prev ?? defaultSelectedIds(activeWaarneemgroepId, waarneemgroepIds);
        const next = new Set(base);
        if (checked) next.add(wgId);
        else next.delete(wgId);
        return next;
      });
    },
    [activeWaarneemgroepId, waarneemgroepIds]
  );

  const loading = waarneemgroepenLoading || (waarneemgroepIds.length > 0 && dienstenLoading);
  const error = waarneemgroepenError ?? dienstenError;

  return (
    <>
      <Head>
        <title>Rooster inzien | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-[2000px] space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 id="welcome-heading" className="text-2xl font-semibold tracking-tight">
                Welkom, {name}
              </h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Je bent ingelogd bij Doktersdienst. Gebruik het menu om naar waarneemgroepen of andere onderdelen te gaan.
            </p>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <Card className="sticky top-6 w-full shrink-0 self-start lg:w-56">
            <CardHeader>
              <CardTitle>Waarneemgroepen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {waarneemgroepenLoading && (
                <p className="text-sm text-muted-foreground">Laden…</p>
              )}
              {!waarneemgroepenLoading && waarneemgroepen?.length === 0 && (
                <p className="text-sm text-muted-foreground">Geen waarneemgroepen.</p>
              )}
              {!waarneemgroepenLoading &&
                waarneemgroepen?.map((wg) => {
                  const id = wg.ID != null && !Number.isNaN(wg.ID) ? wg.ID : 0;
                  const label = wg.naam ?? `Waarneemgroep ${id}`;
                  const checked = idsToShow.has(id);
                  return (
                    <label
                      key={id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleWaarneemgroep(id, !!value)}
                        aria-label={label}
                      />
                      <Label className="cursor-pointer font-normal">{label}</Label>
                    </label>
                  );
                })}
            </CardContent>
          </Card>
          <Card className="min-w-0 flex-1">
            <CardHeader>
              <CardTitle>Rooster inzien</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <p className="mb-4 text-destructive" role="alert">
                  {error}
                </p>
              )}
              {loading && !dienstenResponse && (
                <p className="mb-4 text-muted-foreground">Rooster laden…</p>
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
                showPreferences={false}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}