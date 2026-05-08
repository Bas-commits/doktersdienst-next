'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { CalendarGridWithNavState } from '@/components/CalandarGrid/CalendarGridWithNavState';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { dienstenToShiftBlocks, groupShiftBlocksByWaarneemgroep, withWaarneemgroepNames } from '@/hooks/useDienstenSchedule';
import { useDienstenSubscription } from '@/hooks/useDienstenSubscription';
import { useCalendarVakanties } from '@/hooks/useCalendarVakanties';
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

function timeFromUnix(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function OvernamesPage() {
  const { data: session } = authClient.useSession();
  const name = session?.user?.name ?? session?.user?.email ?? 'daar';

  const now = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const calendarVakanties = useCalendarVakanties(viewYear);

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
  const [pendingRecreateDelete, setPendingRecreateDelete] = useState<{ iddienstovern: number; overnameId?: number } | null>(null);

  // Detail/management modal state (for existing overname blocks)
  const [selectedOvernameBlock, setSelectedOvernameBlock] = useState<ShiftBlockView | null>(null);
  const [detailSubmitting, setDetailSubmitting] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Re-fetch calendar data when any source (header, this page) signals an overname change
  useEffect(() => {
    const onUpdate = () => setRefreshKey((k) => k + 1);
    window.addEventListener('overname-updated', onUpdate);
    return () => window.removeEventListener('overname-updated', onUpdate);
  }, []);

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
          color?: string | null;
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
              color: d.color ?? undefined,
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
    // Block overnames for shifts in the past
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (block.van < nowSeconds) {
      toast.error('Het is niet mogelijk om een overname aan te maken voor een dienst in het verleden.');
      return;
    }
    setPendingRecreateDelete(null);
    setSelectedShift(block);
    setSubmitError(null);
  }, []);

  const handleModalClose = useCallback(() => {
    setSelectedShift(null);
    setSubmitError(null);
    setPendingRecreateDelete(null);
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

        if (pendingRecreateDelete != null) {
          const deleteRes = await fetch('/api/overnames/respond', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete',
              iddienstovern: pendingRecreateDelete.iddienstovern,
              ...(pendingRecreateDelete.overnameId != null && pendingRecreateDelete.overnameId > 0
                ? { overnameId: pendingRecreateDelete.overnameId }
                : {}),
              deleteStatus: 'declined',
            }),
          });
          if (!deleteRes.ok) {
            toast.warning('Nieuw voorstel gemaakt, maar het oude voorstel kon niet automatisch worden verwijderd.');
          }
        }

        setPendingRecreateDelete(null);
        setSelectedShift(null);
        // Notify all listeners (header + this page's calendar) to refresh
        window.dispatchEvent(new Event('overname-updated'));
      } catch {
        setSubmitError('Er is een fout opgetreden');
      } finally {
        setSubmitting(false);
      }
    },
    [selectedShift, activeWaarneemgroepId, pendingRecreateDelete]
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
        window.dispatchEvent(new Event('overname-updated'));
      } catch {
        setDetailError('Er is een fout opgetreden');
      } finally {
        setDetailSubmitting(false);
      }
    },
    [selectedOvernameBlock]
  );

  const recreateByIdDienstOvern = useCallback(async (iddienstovern: number, overnameId?: number) => {
    setDetailError(null);
    const allBlocks = rows.flatMap((r) => r.shiftBlocks);
    const directMatch = allBlocks.find(
      (b) => !b.overnameType && (b.assignedDienstId === iddienstovern || b.id === iddienstovern)
    );
    let originalBlock = directMatch;

    if (!originalBlock) {
      const proposalBlock = overnameId != null && overnameId > 0
        ? allBlocks.find((b) => b.overnameType && b.id === overnameId)
        : allBlocks.find((b) => b.overnameType === 'vraagtekenOvername' && b.iddienstovern === iddienstovern);
      if (proposalBlock) {
        originalBlock = allBlocks.find(
          (b) =>
            !b.overnameType &&
            b.idwaarneemgroep === proposalBlock.idwaarneemgroep &&
            b.van < proposalBlock.tot &&
            b.tot > proposalBlock.van
        );
      }
    }

    if (!originalBlock) {
      setDetailSubmitting(true);
      try {
        const pendingRes = await fetch('/api/overnames/pending', { credentials: 'include' });
        const pendingJson = await pendingRes.json();
        const verzoeken = Array.isArray(pendingJson?.verzoeken) ? pendingJson.verzoeken : [];
        const fallback = verzoeken.find((v: {
          overnameId?: number;
          iddienstovern?: number;
          status?: string | null;
          idwaarneemgroep?: number | null;
          originalVanUnix?: number | null;
          originalTotUnix?: number | null;
          overnameVanUnix?: number;
          overnameTotUnix?: number;
          vanArts?: { initialen?: string; naam?: string; color?: string };
        }) =>
          (overnameId != null && overnameId > 0
            ? Number(v.overnameId ?? 0) === overnameId
            : Number(v.iddienstovern ?? 0) === iddienstovern) &&
          (v.status == null || String(v.status).toLowerCase() === 'declined')
        );

        if (fallback) {
          const startUnix =
            typeof fallback.originalVanUnix === 'number' && fallback.originalVanUnix > 0
              ? fallback.originalVanUnix
              : Number(fallback.overnameVanUnix ?? 0);
          const endUnix =
            typeof fallback.originalTotUnix === 'number' && fallback.originalTotUnix > 0
              ? fallback.originalTotUnix
              : Number(fallback.overnameTotUnix ?? 0);
          if (startUnix > 0 && endUnix > startUnix) {
            const startDate = new Date(startUnix * 1000);
            originalBlock = {
              id: iddienstovern,
              assignedDienstId: iddienstovern,
              day: startDate.getDate(),
              month: startDate.getMonth(),
              year: startDate.getFullYear(),
              van: startUnix,
              tot: endUnix,
              startTime: timeFromUnix(startUnix),
              endTime: timeFromUnix(endUnix),
              currentDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
              nextDate: new Date(endUnix * 1000).toISOString().slice(0, 19).replace('T', ' '),
              middle: fallback.vanArts
                ? {
                    id: 0,
                    name: fallback.vanArts.naam ?? 'Onbekend',
                    shortName: fallback.vanArts.initialen ?? '??',
                    color: fallback.vanArts.color ?? '#7b2d8e',
                  }
                : null,
              top: null,
              bottom: null,
              idwaarneemgroep:
                typeof fallback.idwaarneemgroep === 'number' && fallback.idwaarneemgroep > 0
                  ? fallback.idwaarneemgroep
                  : undefined,
            };
          }
        }
      } catch {
        // Best-effort fallback; final error is shown below if no block could be constructed.
      } finally {
        setDetailSubmitting(false);
      }
    }

    if (!originalBlock) {
      setDetailError('Kon de oorspronkelijke dienst niet vinden om opnieuw voor te stellen.');
      return;
    }

    setSelectedOvernameBlock(null);
    setSelectedShift(originalBlock);
    setSubmitError(null);
    setPendingRecreateDelete({ iddienstovern, ...(overnameId != null && overnameId > 0 ? { overnameId } : {}) });
  }, [rows]);

  const handleOvernameRecreate = useCallback(async () => {
    if (!selectedOvernameBlock?.iddienstovern) return;
    await recreateByIdDienstOvern(selectedOvernameBlock.iddienstovern, selectedOvernameBlock.id);
  }, [selectedOvernameBlock, recreateByIdDienstOvern]);

  // Auto-trigger recreate flow when arriving via ?recreate=<iddienstovern>
  const router = useRouter();
  const recreateHandledRef = useRef<number | null>(null);
  useEffect(() => {
    const raw = router.query.recreate;
    const rawProposal = router.query.recreateProposal;
    const idStr = Array.isArray(raw) ? raw[0] : raw;
    const proposalStr = Array.isArray(rawProposal) ? rawProposal[0] : rawProposal;
    const id = idStr ? Number(idStr) : NaN;
    const proposalId = proposalStr ? Number(proposalStr) : NaN;
    if (!Number.isFinite(id) || id <= 0) return;
    if (recreateHandledRef.current === id) return;
    recreateHandledRef.current = id;
    void recreateByIdDienstOvern(id, Number.isFinite(proposalId) && proposalId > 0 ? proposalId : undefined);
    // Strip the query param so it doesn't re-trigger on reload
    router.replace('/overnames', undefined, { shallow: true });
  }, [router, recreateByIdDienstOvern]);

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
            
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            
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
              vakanties={calendarVakanties}
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
          onRecreate={handleOvernameRecreate}
          onClose={() => { setSelectedOvernameBlock(null); setDetailError(null); }}
          submitting={detailSubmitting}
          error={detailError}
        />
      )}
    </>
  );
}
