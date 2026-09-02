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
import { computeOvernameCaps, canCurrentUserProposeOvername, OVERNAME_ACTION_FORBIDDEN_TOAST } from '@/lib/overname-ui-access';
import { deriveEffectiveRoleTier, GROEP_DEELNEMER } from '@/lib/roles';
import { OvernameModal } from '@/components/OvernameModal';
import { OvernameDetailModal } from '@/components/OvernameDetailModal';
import {
  overnameVerwijzingSleutel,
  overnameVerwijzingUitQuery,
  type OvernameVerwijzing,
} from '@/lib/overname-recreate';
import type { OvernameDoctor } from '@/components/OvernameModal';
import type { ShiftBlockView } from '@/types/diensten';
import { deelnemerChipInitials } from '@/lib/deelnemer-display';
import { Download } from 'lucide-react';
import { naamVoorBestandsnaam } from '@/lib/excel-export';
import { downloadKalender } from '@/lib/kalender-export';

const MAANDNAMEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

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

function buildOvernameRespondPayload(
  block: ShiftBlockView,
  action: 'accept' | 'decline' | 'delete'
) {
  const iddienstovern = Number(block.iddienstovern ?? 0);
  const overnameId = Number(block.id);
  const iddeelnemer = Number(block.iddeelnemer ?? block.originalDoctor?.id ?? 0);
  const iddeelnovern = Number(block.iddeelnovern ?? block.middle?.id ?? 0);

  return {
    action,
    iddienstovern: Number.isFinite(iddienstovern) ? iddienstovern : 0,
    ...(Number.isFinite(overnameId) && overnameId > 0 ? { overnameId } : {}),
    van: block.van,
    tot: block.tot,
    ...(block.idwaarneemgroep != null ? { idwaarneemgroep: block.idwaarneemgroep } : {}),
    ...(Number.isFinite(iddeelnemer) && iddeelnemer > 0 ? { iddeelnemer } : {}),
    ...(Number.isFinite(iddeelnovern) && iddeelnovern > 0 ? { iddeelnovern } : {}),
  };
}

export default function OvernamesPage() {
  const { data: session } = authClient.useSession();

  const now = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const calendarVakanties = useCalendarVakanties(viewYear);

  const { waarneemgroepen, activeWaarneemgroepId, activeWaarneemgroep, loading: waarneemgroepenLoading, error: waarneemgroepenError } = useWaarneemgroep();
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

  const [downloading, setDownloading] = useState(false);

  /** Zet de overnames van de getoonde maand in een Excel-bestand. */
  async function handleDownload() {
    const maand = `${MAANDNAMEN[viewMonth]} ${viewYear}`;
    const groep = activeWaarneemgroep?.naam ?? 'waarneemgroep';
    setDownloading(true);
    try {
      await downloadKalender({
        bestandsnaam: `overnames-${naamVoorBestandsnaam(groep)}-${viewYear}-${String(viewMonth + 1).padStart(2, '0')}.xlsx`,
        bladnaam: 'Overnames',
        kop: `${groep}, ${maand}`,
        rijen: rows,
        metOvername: true,
      });
    } finally {
      setDownloading(false);
    }
  }

  // Propose modal state
  const [selectedShift, setSelectedShift] = useState<ShiftBlockView | null>(null);
  const [allDoctors, setAllDoctors] = useState<(OvernameDoctor & { waarneemgroepIds: number[] })[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /*
    Het afgewezen voorstel dat weg moet zodra het nieuwe verstuurd is. Dit was alleen het
    nummer van de dienst; dat is 0 op negen van de eenentwintig overnamerijen, en dan wees het
    naar niets. Nu de hele verwijzing, dezelfde die respond gebruikt om de rij te vinden.
  */
  const [pendingRecreateDelete, setPendingRecreateDelete] = useState<OvernameVerwijzing | null>(null);

  // Detail/management modal state (for existing overname blocks)
  const [selectedOvernameBlock, setSelectedOvernameBlock] = useState<ShiftBlockView | null>(null);
  const [detailSubmitting, setDetailSubmitting] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [globalIdgroep, setGlobalIdgroep] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (!session?.user) return;

    const abortController = new AbortController();
    fetch('/api/deelnemers/role', {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Kon rol niet ophalen');
        }
        return response.json() as Promise<{ idgroep?: number | null }>;
      })
      .then((data) => {
        setGlobalIdgroep(data.idgroep ?? null);
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          setGlobalIdgroep(GROEP_DEELNEMER);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [session?.user]);

  const roleTier = useMemo(
    () =>
      deriveEffectiveRoleTier({
        globalIdgroep: globalIdgroep ?? null,
        selectedWaarneemgroepIdgroep: activeWaarneemgroep?.idgroep ?? null,
      }),
    [globalIdgroep, activeWaarneemgroep?.idgroep]
  );

  const currentDeelnemerId = useMemo(() => {
    if (session?.user?.id == null || session.user.id === '') return NaN;
    const n = Number(session.user.id);
    return Number.isFinite(n) ? n : NaN;
  }, [session?.user?.id]);

  const detailModalCaps = useMemo(() => {
    if (!selectedOvernameBlock || !Number.isFinite(currentDeelnemerId)) {
      // Deny by default — never expose actions when session user cannot be resolved to a numeric
      // deelnemer id (see Better Auth mapping to `deelnemers`). Previously defaulting "true"
      // unintentionally unlocked delete/accept for every viewer when id parsing failed.
      return { canRespondPending: false, canManageProposalLifecycle: false };
    }
    return computeOvernameCaps({
      currentDeelnemerId,
      globalIdgroep,
      roleTier,
      middleId: selectedOvernameBlock.middle?.id,
      senderId: selectedOvernameBlock.senderId,
    });
  }, [selectedOvernameBlock, currentDeelnemerId, globalIdgroep, roleTier]);

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
          initialen: string | null;
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
              initialen: deelnemerChipInitials(d),
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
    if (
      !canCurrentUserProposeOvername({
        currentDeelnemerId,
        globalIdgroep,
        roleTier,
        assignedMiddleId: block.middle.id,
      })
    ) {
      toast.warning(OVERNAME_ACTION_FORBIDDEN_TOAST);
      return;
    }
    setPendingRecreateDelete(null);
    setSelectedShift(block);
    setSubmitError(null);
  }, [currentDeelnemerId, globalIdgroep, roleTier]);

  const handleModalClose = useCallback(() => {
    setSelectedShift(null);
    setSubmitError(null);
    setPendingRecreateDelete(null);
  }, []);

  const handleModalSubmit = useCallback(
    async (data: { iddeelnovern: number; van: number; tot: number; isPartial: boolean }) => {
      if (!selectedShift || !activeWaarneemgroepId) return;
      if (
        !canCurrentUserProposeOvername({
          currentDeelnemerId,
          globalIdgroep,
          roleTier,
          assignedMiddleId: selectedShift.middle?.id,
        })
      ) {
        toast.warning(OVERNAME_ACTION_FORBIDDEN_TOAST);
        return;
      }
      // Match mobile: prefer assigned type=0 id, else type=1 slot id, else 0 and let the API
      // resolve via van/tot/idwaarneemgroep (legacy rows may have NULL ids).
      const resolvedDienstOvernId =
        (selectedShift.assignedDienstId != null && selectedShift.assignedDienstId > 0)
          ? selectedShift.assignedDienstId
          : (selectedShift.id > 0 ? selectedShift.id : 0);

      setSubmitting(true);
      setSubmitError(null);

      try {
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
              ...pendingRecreateDelete,
              action: 'delete',
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
    [selectedShift, activeWaarneemgroepId, pendingRecreateDelete, currentDeelnemerId, globalIdgroep, roleTier]
  );

  const handleOvernameRespond = useCallback(
    async (action: 'accept' | 'decline' | 'delete') => {
      if (!selectedOvernameBlock) return;

      if (Number.isFinite(currentDeelnemerId)) {
        const caps = computeOvernameCaps({
          currentDeelnemerId,
          globalIdgroep,
          roleTier,
          middleId: selectedOvernameBlock.middle?.id,
          senderId: selectedOvernameBlock.senderId,
        });
        if (action === 'delete' && !caps.canManageProposalLifecycle) {
          toast.warning(OVERNAME_ACTION_FORBIDDEN_TOAST);
          return;
        }
        if (
          (action === 'accept' || action === 'decline') &&
          !caps.canRespondPending
        ) {
          toast.warning(OVERNAME_ACTION_FORBIDDEN_TOAST);
          return;
        }
      } else {
        toast.warning(OVERNAME_ACTION_FORBIDDEN_TOAST);
        return;
      }

      setDetailSubmitting(true);
      setDetailError(null);
      try {
        const res = await fetch('/api/overnames/respond', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildOvernameRespondPayload(selectedOvernameBlock, action)),
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
    [selectedOvernameBlock, currentDeelnemerId, globalIdgroep, roleTier]
  );

  /**
   * Opent het voorstelscherm opnieuw voor de dienst waar een afgewezen voorstel bij hoort.
   *
   * De dienst wordt op drie manieren gezocht, van zeker naar behelpen: op het nummer van de
   * dienst als de rij dat heeft, anders op overlap in de geladen maand, en anders uit de lijst
   * openstaande verzoeken. Die laatste zocht op het nummer van de dienst en dus op 0, wat de
   * eerste de beste oude rij opleverde in plaats van deze; nu op groep, begin en eind, en die
   * drie samen wijzen een rij aan.
   */
  const startOvernameOpnieuw = useCallback(async (
    verwijzing: OvernameVerwijzing,
    /*
      Waar een melding terechtkomt. Vanuit het rooster staat de popup nog open en hoort hij
      daarin; vanuit de knop bovenin het scherm is er geen popup, en daar ging een melding
      eerder verloren: het scherm sprong naar deze pagina en er gebeurde zichtbaar niets.
    */
    melding: 'popup' | 'toast' = 'popup',
  ) => {
    const meld = (tekst: string) => {
      if (melding === 'toast') toast.error(tekst);
      else setDetailError(tekst);
    };
    setDetailError(null);
    const allBlocks = rows.flatMap((r) => r.shiftBlocks);
    const overlapt = (b: ShiftBlockView) =>
      (b.idwaarneemgroep == null || b.idwaarneemgroep === verwijzing.idwaarneemgroep) &&
      b.van < verwijzing.tot &&
      b.tot > verwijzing.van;

    let originalBlock =
      (verwijzing.iddienstovern > 0
        ? allBlocks.find(
            (b) =>
              !b.overnameType &&
              (b.assignedDienstId === verwijzing.iddienstovern ||
                b.id === verwijzing.iddienstovern)
          )
        : undefined) ?? allBlocks.find((b) => !b.overnameType && overlapt(b));

    if (!originalBlock) {
      setDetailSubmitting(true);
      try {
        const pendingRes = await fetch('/api/overnames/pending', { credentials: 'include' });
        const pendingJson = await pendingRes.json();
        const verzoeken = Array.isArray(pendingJson?.verzoeken) ? pendingJson.verzoeken : [];
        const fallback = verzoeken.find((v: {
          status?: string | null;
          idwaarneemgroep?: number | null;
          originalVanUnix?: number | null;
          originalTotUnix?: number | null;
          overnameVanUnix?: number;
          overnameTotUnix?: number;
          vanArts?: { initialen?: string; naam?: string; color?: string };
        }) =>
          Number(v.idwaarneemgroep ?? 0) === verwijzing.idwaarneemgroep &&
          Number(v.overnameVanUnix ?? 0) === verwijzing.van &&
          Number(v.overnameTotUnix ?? 0) === verwijzing.tot &&
          (v.status == null || String(v.status).toLowerCase() === 'declined')
        );

        if (fallback) {
          // Bij voorkeur de grenzen van de oorspronkelijke dienst. Die ontbreken als de rij
          // geen dienst aanwijst, en dan zijn de grenzen van het voorstel het enige dat er is;
          // bij een gedeeltelijke overname is dat smaller dan de dienst zelf.
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
              id: verwijzing.iddienstovern,
              assignedDienstId: verwijzing.iddienstovern,
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
                    id: verwijzing.iddeelnemer ?? 0,
                    name: fallback.vanArts.naam ?? 'Onbekend',
                    shortName: fallback.vanArts.initialen ?? '??',
                    color: fallback.vanArts.color ?? '#7b2d8e',
                  }
                : null,
              top: null,
              bottom: null,
              idwaarneemgroep: verwijzing.idwaarneemgroep,
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
      meld('Kon de oorspronkelijke dienst niet vinden om opnieuw voor te stellen.');
      return;
    }

    // Dezelfde grens als bij het aanklikken van een dienst. Een overname voor een dienst die
    // al geweest is kan daar niet, dus hier ook niet; anders is de knop een sluiproute.
    if (originalBlock.van < Math.floor(Date.now() / 1000)) {
      meld('Het is niet mogelijk om een overname aan te maken voor een dienst in het verleden.');
      return;
    }

    setSelectedOvernameBlock(null);
    setSelectedShift(originalBlock);
    setSubmitError(null);
    setPendingRecreateDelete(verwijzing);
  }, [rows]);

  const handleOvernameRecreate = useCallback(async () => {
    const block = selectedOvernameBlock;
    if (!block) return;
    await startOvernameOpnieuw({
      iddienstovern: Number(block.iddienstovern ?? 0),
      ...(Number(block.id) > 0 ? { overnameId: Number(block.id) } : {}),
      idwaarneemgroep: Number(block.idwaarneemgroep ?? activeWaarneemgroepId ?? 0),
      van: block.van,
      tot: block.tot,
      ...(Number(block.iddeelnemer ?? block.originalDoctor?.id ?? 0) > 0
        ? { iddeelnemer: Number(block.iddeelnemer ?? block.originalDoctor?.id) }
        : {}),
      ...(Number(block.iddeelnovern ?? block.middle?.id ?? 0) > 0
        ? { iddeelnovern: Number(block.iddeelnovern ?? block.middle?.id) }
        : {}),
    });
  }, [selectedOvernameBlock, activeWaarneemgroepId, startOvernameOpnieuw]);

  // De knop bovenin het scherm komt hier binnen met de verwijzing in de adresbalk.
  const router = useRouter();
  const recreateHandledRef = useRef<string | null>(null);
  useEffect(() => {
    const verwijzing = overnameVerwijzingUitQuery(router.query);
    if (!verwijzing) return;
    // Op de sleutel en niet op het nummer van de dienst: dat is vaak 0 en zou de tweede
    // opdracht voor een andere dienst als al afgehandeld aanzien.
    const sleutel = overnameVerwijzingSleutel(verwijzing);
    if (recreateHandledRef.current === sleutel) return;
    recreateHandledRef.current = sleutel;
    void startOvernameOpnieuw(verwijzing, 'toast');
    // Strip the query param so it doesn't re-trigger on reload
    router.replace('/overnames', undefined, { shallow: true });
  }, [router, startOvernameOpnieuw]);

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
            {/*
              De knop pakt de maand die in de kalender staat. Een eigen periodekeuze zou hier
              een tweede plek zijn waar de maand gekozen wordt, naast de kalender zelf.
            */}
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={loading || downloading || rows.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded border bg-background px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              title={
                rows.length === 0
                  ? 'Geen overnames in deze maand'
                  : 'Download deze maand als Excel-bestand'
              }
            >
              <Download className="size-4" aria-hidden />
              Download Excel
            </button>
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
          canRespondPending={detailModalCaps.canRespondPending}
          canManageProposalLifecycle={detailModalCaps.canManageProposalLifecycle}
          waarneemgroepNaam={activeWaarneemgroep?.naam ?? null}
        />
      )}
    </>
  );
}
