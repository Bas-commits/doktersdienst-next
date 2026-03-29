'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { CalendarGridWithNavState } from '@/components/CalandarGrid/CalendarGridWithNavState';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { dienstenToShiftBlocks, groupShiftBlocksByWaarneemgroep, withWaarneemgroepNames } from '@/hooks/useDienstenSchedule';
import { useDienstenSubscription } from '@/hooks/useDienstenSubscription';
import { OvernameModal } from '@/components/OvernameModal';
import type { OvernameDoctor } from '@/components/OvernameModal';
import type { ShiftBlockView } from '@/types/diensten';

const TWO_WEEKS_SECONDS = 14 * 24 * 60 * 60;

/** Unix seconds for start of first day of month (0-based), minus 2 weeks so adjacent visible days have data. */
function vanGteForMonth(viewMonth: number, viewYear: number): number {
  return Math.floor(new Date(viewYear, viewMonth, 1, 0, 0, 0, 0).getTime() / 1000) - TWO_WEEKS_SECONDS;
}

/** Unix seconds for end of last day of month (23:59:59), plus 2 weeks so adjacent visible days have data. */
function totLteForMonth(viewMonth: number, viewYear: number): number {
  return Math.floor(new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999).getTime() / 1000) + TWO_WEEKS_SECONDS;
}

/** Type 0 = standard assigned, 1 = unassigned slot, 4 = overname voorstel, 6 = confirmed overname. */
const OVERNAME_TYPES = [0, 1, 4, 6];

export default function OvernamesPage() {
  const { data: session } = authClient.useSession();
  const name = session?.user?.name ?? session?.user?.email ?? 'daar';

  const now = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const { waarneemgroepen, activeWaarneemgroepId, loading: waarneemgroepenLoading, error: waarneemgroepenError } = useWaarneemgroep();
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
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: dienstenResponse, loading: dienstenLoading, error: dienstenError } = useDienstenSubscription(
    vanGte,
    totLte,
    waarneemgroepIds,
    OVERNAME_TYPES,
    undefined,
    refreshKey
  );

  const rows = useMemo(() => {
    const blocks = dienstenToShiftBlocks(dienstenResponse ?? null);
    return withWaarneemgroepNames(groupShiftBlocksByWaarneemgroep(blocks), waarneemgroepNameSource);
  }, [dienstenResponse, waarneemgroepNameSource]);

  const loading = waarneemgroepenLoading || (waarneemgroepIds.length > 0 && dienstenLoading);
  const error = waarneemgroepenError ?? dienstenError;

  // Modal state
  const [selectedShift, setSelectedShift] = useState<ShiftBlockView | null>(null);
  const [doctors, setDoctors] = useState<OvernameDoctor[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch doctors for the dropdown when the modal opens
  useEffect(() => {
    if (!selectedShift || !activeWaarneemgroepId) return;
    fetch(`/api/deelnemers?idwaarneemgroep=${activeWaarneemgroepId}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.deelnemers) {
          setDoctors(
            data.deelnemers.map((d: { id: number; voornaam: string | null; achternaam: string | null }) => ({
              id: d.id,
              voornaam: d.voornaam ?? '',
              achternaam: d.achternaam ?? '',
              initialen: (d.voornaam?.[0] ?? '').toUpperCase() + (d.achternaam?.[0] ?? '').toUpperCase(),
            }))
          );
        }
      })
      .catch(() => setDoctors([]));
  }, [selectedShift, activeWaarneemgroepId]);

  const handleShiftClick = useCallback((block: ShiftBlockView) => {
    // Only open modal for assigned shifts (has a middle doctor), not for overlays or unassigned slots
    if (!block.middle || block.overnameType) return;
    setSelectedShift(block);
    setSubmitError(null);
  }, []);

  const handleModalClose = useCallback(() => {
    setSelectedShift(null);
    setSubmitError(null);
  }, []);

  const handleModalSubmit = useCallback(
    async (data: { iddeelnovern: number; van: number; tot: number; isPartial: boolean }) => {
      if (!selectedShift || !activeWaarneemgroepId) return;

      setSubmitting(true);
      setSubmitError(null);

      try {
        const res = await fetch('/api/overnames/propose', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            iddienstovern: selectedShift.id,
            iddeelnovern: data.iddeelnovern,
            van: data.van,
            tot: data.tot,
            idwaarneemgroep: Number(activeWaarneemgroepId),
          }),
        });

        const result = await res.json();

        if (!res.ok) {
          setSubmitError(result.error || 'Er is een fout opgetreden');
          return;
        }

        setSelectedShift(null);
        setRefreshKey((k) => k + 1);
      } catch {
        setSubmitError('Er is een fout opgetreden');
      } finally {
        setSubmitting(false);
      }
    },
    [selectedShift, activeWaarneemgroepId]
  );

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
            <CardTitle>Voorkeuren kiezen</CardTitle>
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
              showPreferences={false}
              onShiftClick={handleShiftClick}
            />
          </CardContent>
        </Card>
      </div>

      {selectedShift && (
        <OvernameModal
          shift={selectedShift}
          doctors={doctors}
          onSubmit={handleModalSubmit}
          onClose={handleModalClose}
          submitting={submitting}
          error={submitError}
        />
      )}
    </>
  );
}
