'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { CalendarGridWithNavState } from '@/components/CalandarGrid/CalendarGridWithNavState';
import { ChipSelector, CHIP_STYLE } from '@/components/voorkeuren/ChipSelector';
import { dienstenToShiftBlocks, dienstenToShiftBlocksFromParticipant, groupShiftBlocksByWaarneemgroep } from '@/hooks/useDienstenSchedule';
import { useDienstenSubscription } from '@/hooks/useDienstenSubscription';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { shiftKeyFromBlock, getChipByCode } from '@/types/voorkeuren';
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

const WEGHALEN_CODE = '1014';

/** Type 1 = unassigned slot (empty shift block). */
const TYPE_UNASSIGNED_SLOT = 1;
/** Types for user preference rows (2, 3, 9, 10, 5001). */
const USER_DIENST_TYPES = [2, 3, 9, 10, 5001] as const;

export default function VoorkeurenPage() {
  const { data: session } = authClient.useSession();
  const name = session?.user?.name ?? session?.user?.email ?? 'daar';

  const { activeWaarneemgroepId, activeWaarneemgroep, loading: waarneemgroepContextLoading, error: waarneemgroepContextError } = useWaarneemgroep();

  const now = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const [selectedChipCode, setSelectedChipCode] = useState<string | null>(null);
  const [pendingInsert, setPendingInsert] = useState<Map<string, string>>(new Map());
  const [pendingDelete, setPendingDelete] = useState<Set<string>>(new Set());
  const [preferenceApiError, setPreferenceApiError] = useState<string | null>(null);
  /** Block duplicate API calls: keys of slots that have a request in flight. */
  const inFlightKeysRef = useRef<Set<string>>(new Set());
  /** Cursor position for chip preview (only used when selectedChipCode is set). */
  const [cursorPreview, setCursorPreview] = useState<{ x: number; y: number } | null>(null);

  /** Only the selected waarneemgroep in the header (one at a time). */
  const waarneemgroepIds = useMemo(() => {
    if (!activeWaarneemgroepId) return [];
    const id = Number(activeWaarneemgroepId);
    return Number.isNaN(id) ? [] : [id];
  }, [activeWaarneemgroepId]);

  const vanGte = useMemo(() => vanGteForMonth(viewMonth, viewYear), [viewMonth, viewYear]);
  const totLte = useMemo(() => totLteForMonth(viewMonth, viewYear), [viewMonth, viewYear]);
  const idDeelnemer = useMemo(() => {
    const id = session?.user?.id;
    if (id == null) return null;
    const n = Number(id);
    return Number.isNaN(n) ? null : n;
  }, [session?.user?.id]);
  /** Empty slots (type 1) for the calendar grid. */
  const { data: type1Response, loading: type1Loading, error: type1Error } = useDienstenSubscription(
    vanGte,
    totLte,
    waarneemgroepIds,
    [TYPE_UNASSIGNED_SLOT]
  );
  /** User's assigned diensten (types 2, 3, 9, 10, 5001), one-time fetch at page load. */
  const { data: userDienstenResponse, loading: userDienstenLoading, error: userDienstenError } = useDienstenSubscription(
    vanGte,
    totLte,
    waarneemgroepIds,
    [...USER_DIENST_TYPES],
    idDeelnemer ?? null
  );

  const rows = useMemo(() => {
    const emptyBlocks = dienstenToShiftBlocks(type1Response ?? null);
    const userBlocks = dienstenToShiftBlocksFromParticipant(userDienstenResponse ?? null);
    const userBySlot = new Map<string, (typeof userBlocks)[0]['middle']>();
    const typeBySlot = new Map<string, number>();
    for (const b of userBlocks) {
      const key = `${b.van}-${b.tot}-${b.idwaarneemgroep ?? ''}`;
      userBySlot.set(key, b.middle);
    }
    for (const d of userDienstenResponse?.data?.diensten ?? []) {
      const key = `${d.van}-${d.tot}-${d.idwaarneemgroep ?? ''}`;
      typeBySlot.set(key, d.type);
    }
    const blocks = emptyBlocks.map((block) => {
      const key = `${block.van}-${block.tot}-${block.idwaarneemgroep ?? ''}`;
      if (pendingDelete.has(key)) return block;
      const assigned = userBySlot.get(key);
      const type = typeBySlot.get(key);
      if (assigned && type != null) {
        return { ...block, middle: assigned, assignedPreferenceCode: String(type) };
      }
      if (assigned) {
        return { ...block, middle: assigned };
      }
      return block;
    });
    const grouped = groupShiftBlocksByWaarneemgroep(blocks);
    return grouped.map((row) => ({
      ...row,
      name: activeWaarneemgroep?.naam ?? row.name,
    }));
  }, [type1Response, userDienstenResponse, activeWaarneemgroep?.naam, pendingDelete]);

  const loading = waarneemgroepContextLoading || (waarneemgroepIds.length > 0 && (type1Loading || userDienstenLoading));
  const error = waarneemgroepContextError ?? type1Error ?? userDienstenError;

  const handleShiftClick = useCallback(
    async (block: ShiftBlockView) => {
      if (selectedChipCode === null) return;
      if (block.idwaarneemgroep == null) return;
      const key = shiftKeyFromBlock(block);
      if (inFlightKeysRef.current.has(key)) return;
      inFlightKeysRef.current.add(key);

      const idwaarneemgroep = block.idwaarneemgroep;
      const action = selectedChipCode === WEGHALEN_CODE ? 'remove' : 'add';

      setPreferenceApiError(null);
      if (action === 'remove') {
        setPendingInsert((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        setPendingDelete((prev) => new Set(prev).add(key));
      } else {
        setPendingDelete((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setPendingInsert((prev) => new Map(prev).set(key, selectedChipCode));
      }

      const body = {
        action,
        van: block.van,
        tot: block.tot,
        idwaarneemgroep,
        ...(action === 'add' && { type: Number(selectedChipCode) }),
        currentDate: block.currentDate,
        nextDate: block.nextDate,
      };

      const PREFERENCE_REQUEST_TIMEOUT_MS = 2000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PREFERENCE_REQUEST_TIMEOUT_MS);

      function revertPending() {
        if (action === 'remove') {
          setPendingDelete((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        } else {
          setPendingInsert((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        }
      }

      function showFailure(reason: string) {
        setPreferenceApiError(reason);
        toast.error('Voorkeur niet opgeslagen', { description: reason });
      }

      try {
        const res = await fetch('/api/diensten/preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          revertPending();
          const message = typeof data?.error === 'string' ? data.error : 'Voorkeur opslaan mislukt.';
          showFailure(message);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        revertPending();
        const reason =
          err instanceof Error && err.name === 'AbortError'
            ? 'Verzoek duurde te lang. Probeer het opnieuw.'
            : err instanceof Error
              ? err.message
              : 'Voorkeur opslaan mislukt.';
        showFailure(reason);
      } finally {
        inFlightKeysRef.current.delete(key);
      }
    },
    [selectedChipCode]
  );

  const calendarGridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedChipCode) {
      setCursorPreview(null);
      return;
    }
    function onMove(e: MouseEvent) {
      setCursorPreview({ x: e.clientX, y: e.clientY });
    }
    function onLeave() {
      setCursorPreview(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedChipCode(null);
    }
    function onPointerDown(e: MouseEvent) {
      const el = calendarGridRef.current;
      if (!el || !el.contains(e.target as Node)) setSelectedChipCode(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [selectedChipCode]);

  const chipStyle = selectedChipCode ? CHIP_STYLE[selectedChipCode] : null;
  const CursorChipIcon = chipStyle?.Icon;

  return (
    <>
      {cursorPreview && chipStyle && CursorChipIcon && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-9999 flex h-9 w-9 items-center justify-center rounded-md border-2 border-primary shadow-lg"
          style={{
            left: cursorPreview.x + 12,
            top: cursorPreview.y + 12,
            backgroundColor: chipStyle.backgroundColor,
            borderColor: 'var(--primary)',
          }}
        >
          <CursorChipIcon className="h-4 w-4 shrink-0" style={{ color: chipStyle.iconColor }} />
        </div>
      )}
      <Head>
        <title>Voorkeuren | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-[2000px] space-y-6 px-4 py-8">
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
              Openstaande diensten (type 1) voor de geselecteerde waarneemgroep; uw toegewezen diensten worden bij het laden opgehaald.
              {activeWaarneemgroep ? ` Huidige groep: ${activeWaarneemgroep.naam}.` : ' Selecteer een waarneemgroep in de header.'}
              {' '}Welkom, {name}. Selecteer een voorkeur en klik op een dienst in de kalender om deze toe te wijzen.
            </p>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6 lg:flex-row">
          <Card className="shrink-0 lg:w-[220px]">
            <CardHeader>
              <CardTitle className="text-base">Voorkeur kiezen</CardTitle>
            </CardHeader>
            <CardContent>
              <ChipSelector
                selectedChipCode={selectedChipCode}
                onSelectChip={setSelectedChipCode}
              />
            </CardContent>
          </Card>
          <Card className="min-w-0 flex-1">
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
              {preferenceApiError && (
                <p className="mb-4 text-destructive" role="alert">
                  {preferenceApiError}
                </p>
              )}
              {!activeWaarneemgroepId && !loading && (
                <p className="mb-4 text-muted-foreground">
                  Selecteer een waarneemgroep in de header om openstaande diensten te zien.
                </p>
              )}
              {loading && !type1Response && waarneemgroepIds.length > 0 && (
                <p className="mb-4 text-muted-foreground">Voorkeuren laden…</p>
              )}
              {selectedChipCode && (
                <p className="mb-4 text-sm text-muted-foreground">
                  Geselecteerd: klik op een dienst in de kalender om deze voorkeur toe te wijzen.
                </p>
              )}
              {waarneemgroepIds.length > 0 && (
                <div ref={calendarGridRef}>
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
                    onShiftClick={
                      selectedChipCode
                        ? (block) => handleShiftClick(block)
                        : undefined
                    }
                    pendingInsert={pendingInsert}
                    pendingDelete={pendingDelete}
                    getChipByCode={getChipByCode}
                    showPreferences={false}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
