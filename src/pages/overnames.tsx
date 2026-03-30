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
import { OvernameDetailModal } from '@/components/OvernameDetailModal';
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
    if (!activeWaarneemgroepId) return [];
    const id = Number(activeWaarneemgroepId);
    return Number.isNaN(id) ? [] : [id];
  }, [activeWaarneemgroepId]);
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

  // Propose modal state
  const [selectedShift, setSelectedShift] = useState<ShiftBlockView | null>(null);
  const [allDoctors, setAllDoctors] = useState<(OvernameDoctor & { waarneemgroepIds: number[] })[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Detail/management modal state (for existing overname blocks)
  const [selectedOvernameBlock, setSelectedOvernameBlock] = useState<ShiftBlockView | null>(null);
  const [detailSubmitting, setDetailSubmitting] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Fetch all accessible doctors once (same approach as rooster-maken-secretaris)
  useEffect(() => {
    if (!activeWaarneemgroepId) return;
    fetch('/api/deelnemers', { credentials: 'include' })
      .then((res) => res.json())
      .then((data: {
        deelnemers?: Array<{
          id: number;
          voornaam: string | null;
          achternaam: string | null;
          waarneemgroepen: { id: number; naam: string | null; aangemeld: boolean }[];
        }>;
      }) => {
        if (data?.deelnemers) {
          setAllDoctors(
            data.deelnemers.map((d) => ({
              id: d.id,
              voornaam: d.voornaam ?? '',
              achternaam: d.achternaam ?? '',
              initialen: (d.voornaam?.[0] ?? '').toUpperCase() + (d.achternaam?.[0] ?? '').toUpperCase(),
              waarneemgroepIds: d.waarneemgroepen
                .filter((wg) => wg.aangemeld)
                .map((wg) => wg.id),
            }))
          );
        }
      })
      .catch(() => setAllDoctors([]));
  }, [activeWaarneemgroepId]);

  // Filter to only doctors aangemeld in the active waarneemgroep
  const doctors = useMemo(() => {
    const wgId = Number(activeWaarneemgroepId);
    if (!wgId) return [];
    return allDoctors.filter((d) => d.waarneemgroepIds.includes(wgId));
  }, [allDoctors, activeWaarneemgroepId]);

  const handleShiftClick = useCallback((block: ShiftBlockView) => {
    // Overname overlay blocks → open detail/management modal
    if (block.overnameType) {
      setSelectedOvernameBlock(block);
      setDetailError(null);
      return;
    }
    // Assigned shifts (has a middle doctor) → open propose modal
    if (!block.middle) return;
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
      const resolvedDienstOvernId =
        (selectedShift.assignedDienstId != null && selectedShift.assignedDienstId > 0)
          ? selectedShift.assignedDienstId
          : (selectedShift.id > 0 ? selectedShift.id : 0);

      setSubmitting(true);
      setSubmitError(null);

      try {
        if (!resolvedDienstOvernId || resolvedDienstOvernId <= 0) {
          setSubmitError('Kon de originele dienst niet bepalen');
          return;
        }
        const res = await fetch('/api/overnames/propose', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            iddienstovern: resolvedDienstOvernId,
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
        // Notify the header to refresh pending verzoeken
        window.dispatchEvent(new Event('overname-updated'));
      } catch {
        setSubmitError('Er is een fout opgetreden');
      } finally {
        setSubmitting(false);
      }
    },
    [selectedShift, activeWaarneemgroepId]
  );

  const handleOvernameRespond = useCallback(
    async (action: 'accept' | 'decline' | 'delete') => {
      if (!selectedOvernameBlock?.iddienstovern) return;
      setDetailSubmitting(true);
      setDetailError(null);
      try {
        const res = await fetch('/api/overnames/respond', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ iddienstovern: selectedOvernameBlock.iddienstovern, action }),
        });
        const result = await res.json();
        if (!res.ok) {
          setDetailError(result.error || 'Er is een fout opgetreden');
          return;
        }
        setSelectedOvernameBlock(null);
        setRefreshKey((k) => k + 1);
        window.dispatchEvent(new Event('overname-updated'));
      } catch {
        setDetailError('Er is een fout opgetreden');
      } finally {
        setDetailSubmitting(false);
      }
    },
    [selectedOvernameBlock]
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

      {selectedOvernameBlock && (
        <OvernameDetailModal
          block={selectedOvernameBlock}
          onRespond={handleOvernameRespond}
          onClose={() => { setSelectedOvernameBlock(null); setDetailError(null); }}
          submitting={detailSubmitting}
          error={detailError}
        />
      )}
    </>
  );
}
