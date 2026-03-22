'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { CalendarGridWithNavState } from '@/components/CalandarGrid/CalendarGridWithNavState';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { dienstenToShiftBlocks, groupShiftBlocksByWaarneemgroep, withWaarneemgroepNames } from '@/hooks/useDienstenSchedule';
import { useDienstenSubscription } from '@/hooks/useDienstenSubscription';
import { useVoorkeurenSubscription } from '@/hooks/useVoorkeurenSubscription';

const TWO_WEEKS_SECONDS = 14 * 24 * 60 * 60;

function vanGteForMonth(viewMonth: number, viewYear: number): number {
  return Math.floor(new Date(viewYear, viewMonth, 1, 0, 0, 0, 0).getTime() / 1000) - TWO_WEEKS_SECONDS;
}

function totLteForMonth(viewMonth: number, viewYear: number): number {
  return Math.floor(new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999).getTime() / 1000) + TWO_WEEKS_SECONDS;
}

function defaultSelectedIds(activeId: string | null): Set<number> {
  if (!activeId) return new Set();
  const n = Number(activeId);
  return Number.isNaN(n) ? new Set() : new Set([n]);
}

export default function RoosterMakenSecretarisPage() {
  const { data: session } = authClient.useSession();
  const name = session?.user?.name ?? session?.user?.email ?? 'daar';
  const { activeWaarneemgroepId, waarneemgroepen, loading: waarneemgroepenLoading, error: waarneemgroepenError } = useWaarneemgroep();

  const now = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [selectedIds, setSelectedIds] = useState<Set<number> | null>(null);

  const waarneemgroepIds = useMemo(() => {
    if (!waarneemgroepen?.length) return [];
    return waarneemgroepen.map((wg) => wg.ID).filter((id): id is number => id != null && !Number.isNaN(id));
  }, [waarneemgroepen]);

  const waarneemgroepNameSource = useMemo(
    () => (waarneemgroepen?.length ? waarneemgroepen.map((w) => ({ id: w.ID, naam: w.naam })) : null),
    [waarneemgroepen]
  );

  const vanGte = useMemo(() => vanGteForMonth(viewMonth, viewYear), [viewMonth, viewYear]);
  const totLte = useMemo(() => totLteForMonth(viewMonth, viewYear), [viewMonth, viewYear]);
  const { data: dienstenResponse, loading: dienstenLoading, error: dienstenError } = useDienstenSubscription(
    vanGte,
    totLte,
    waarneemgroepIds
  );

  const allRows = useMemo(() => {
    const blocks = dienstenToShiftBlocks(dienstenResponse ?? null);
    return groupShiftBlocksByWaarneemgroep(blocks);
  }, [dienstenResponse]);

  const idsToShow = useMemo(
    () => (selectedIds !== null ? selectedIds : defaultSelectedIds(activeWaarneemgroepId)),
    [selectedIds, activeWaarneemgroepId]
  );

  const rows = useMemo(
    () => withWaarneemgroepNames(
      allRows.filter((row) => idsToShow.has(row.id)),
      waarneemgroepNameSource
    ),
    [allRows, idsToShow, waarneemgroepNameSource]
  );

  const selectedWaarneemgroepIds = useMemo(() => Array.from(idsToShow), [idsToShow]);
  const { data: voorkeuren } = useVoorkeurenSubscription(vanGte, totLte, selectedWaarneemgroepIds);

  useEffect(() => {
    if (voorkeuren !== null) {
      console.log('[rooster-maken-secretaris] voorkeuren:', voorkeuren);
    }
  }, [voorkeuren]);

  const toggleWaarneemgroep = useCallback(
    (wgId: number, checked: boolean) => {
      setSelectedIds((prev) => {
        const base = prev ?? defaultSelectedIds(activeWaarneemgroepId);
        const next = new Set(base);
        if (checked) next.add(wgId);
        else next.delete(wgId);
        return next;
      });
    },
    [activeWaarneemgroepId]
  );

  const loading = waarneemgroepenLoading || (waarneemgroepIds.length > 0 && dienstenLoading);
  const error = waarneemgroepenError ?? dienstenError;

  return (
    <>
      <Head>
        <title>Rooster maken secretaris | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-[2000px] space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl font-semibold tracking-tight">
                Rooster maken secretaris
              </h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Welkom, {name}. Gebruik het kalenderoverzicht per waarneemgroep.
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
              <CardTitle>Kalenderoverzicht</CardTitle>
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
                voorkeuren={voorkeuren ?? undefined}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
