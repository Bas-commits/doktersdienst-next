'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { FaFilter } from 'react-icons/fa';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Info } from 'lucide-react';

import { CalendarGridWithNavState } from '@/components/CalandarGrid/CalendarGridWithNavState';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { dienstenToShiftBlocks, groupShiftBlocksByWaarneemgroep, withWaarneemgroepNames } from '@/hooks/useDienstenSchedule';
import { useDienstenSubscription, clearCacheByPrefix } from '@/hooks/useDienstenSubscription';
import { useVoorkeurenSubscription } from '@/hooks/useVoorkeurenSubscription';
import type { ShiftBlockView } from '@/types/diensten';

const TWO_WEEKS_SECONDS = 14 * 24 * 60 * 60;

function vanGteForMonth(viewMonth: number, viewYear: number): number {
  return Math.floor(new Date(viewYear, viewMonth, 1, 0, 0, 0, 0).getTime() / 1000) - TWO_WEEKS_SECONDS;
}

function totLteForMonth(viewMonth: number, viewYear: number): number {
  return Math.floor(new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999).getTime() / 1000) + TWO_WEEKS_SECONDS;
}

interface Doctor {
  id: number;
  voornaam: string | null;
  achternaam: string | null;
  color: string | null;
  initials: string;
  fullName: string;
  waarneemgroepIds: number[];
}

function toInitials(voornaam: string | null, achternaam: string | null): string {
  return ((voornaam?.[0] ?? '') + (achternaam?.[0] ?? '')).toUpperCase();
}

function toFullName(voornaam: string | null, achternaam: string | null): string {
  return [voornaam, achternaam].filter(Boolean).join(' ') || 'Onbekend';
}

function InfoPopover() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-label="Toon informatie over voorkeuren"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gray-200"
      >
        <Info className="h-6 w-6 text-muted-foreground" />
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute top-full left-1/2 z-9999 mt-2 w-[700px] max-w-[calc(100vw-2rem)] -translate-x-1/4 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none "
        >
          <div className="absolute -top-1 left-1/4 h-2 w-2 -translate-x-1/2 rotate-45 border-t border-l bg-popover" />
          <h2 className="mb-2 text-base font-semibold">Procedure:</h2>
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Klik op een van de fiches, links in het scherm</li>
            <li>De fiche kleeft aan de cursor.</li>
            <li>Klik op de shifts/diensten waarvoor u een voorkeur wilt aangeven.</li>
            <li>Herhaal dit voor andere voorkeuren voor shifts/diensten.</li>
          </ul>
          <p className="mb-3 text-sm text-muted-foreground">
            <strong>NB: U kunt meerdere diensten in 1 keer markeren door na een eerste klik de knop ingedrukt te houden, terwijl u over de andere diensten heen beweegt.
            </strong>
            </p>
          
        </div>
      )}
    </div>
  );
}

function defaultSelectedIds(activeId: string | null, waarneemgroepIds: number[]): Set<number> {
  if (activeId) {
    const n = Number(activeId);
    if (!Number.isNaN(n)) return new Set([n]);
  }
  if (waarneemgroepIds.length > 0) return new Set([waarneemgroepIds[0]]);
  return new Set();
}

function FilterPopover({
  waarneemgroepen,
  loading,
  idsToShow,
  totalCount,
  onToggle,
}: {
  waarneemgroepen: { ID: number; naam: string | null }[];
  loading: boolean;
  idsToShow: Set<number>;
  totalCount: number;
  onToggle: (id: number, checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const hasFilter = idsToShow.size < totalCount;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`cursor-pointer rounded p-1 transition-colors hover:bg-gray-100 ${hasFilter ? 'text-blue-600' : 'text-gray-500'}`}
        aria-label="Filter waarneemgroepen"
      >
        <FaFilter className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 rounded-md border bg-white p-3 shadow-lg">
          <p className="mb-2 text-sm font-medium">Waarneemgroepen</p>
          {loading && (
            <p className="text-sm text-muted-foreground">Laden…</p>
          )}
          {!loading && waarneemgroepen.length === 0 && (
            <p className="text-sm text-muted-foreground">Geen waarneemgroepen.</p>
          )}
          <div className="space-y-2">
            {!loading &&
              waarneemgroepen.map((wg) => {
                const id = wg.ID != null && !Number.isNaN(wg.ID) ? wg.ID : 0;
                const label = wg.naam ?? `Waarneemgroep ${id}`;
                const checked = idsToShow.has(id);
                return (
                  <label key={id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => onToggle(id, !!value)}
                      aria-label={label}
                    />
                    <Label className="cursor-pointer font-normal">{label}</Label>
                  </label>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

const GROEP_SECRETARIS = 2;

/** Section label for toast messages. */
const SECTION_LABEL: Record<string, string> = {
  middle: 'Standaard',
  top: 'Achterwacht',
  bottom: 'Extra Dokter',
};

export default function RoosterMakenSecretarisPage() {
  const { activeWaarneemgroepId, waarneemgroepen, loading: waarneemgroepenLoading, error: waarneemgroepenError } = useWaarneemgroep();

  const now = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  // All doctors fetched from API
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  // Currently selected doctor (follows cursor)
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  // Delete mode: clicking a filled stripe removes the assignment
  const [deleteMode, setDeleteMode] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  // Prevent double-click during in-flight API call
  const [isAssigning, setIsAssigning] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  /** When null, effective selection is "only header-selected". When set, user has toggled checkboxes. */
  const [selectedIds, setSelectedIds] = useState<Set<number> | null>(null);

  /** Only groups where the current user is a secretaris. Used to filter the popover. */
  const secretarisWaarneemgroepen = useMemo(
    () => (waarneemgroepen ?? []).filter((wg) => wg.idgroep === GROEP_SECRETARIS),
    [waarneemgroepen]
  );

  /** True when the active group exists but the user is not a secretaris for it. */
  const isActiveGroupForbidden = useMemo(() => {
    if (!activeWaarneemgroepId) return false;
    const n = Number(activeWaarneemgroepId);
    if (Number.isNaN(n)) return false;
    const activeWg = (waarneemgroepen ?? []).find((wg) => wg.ID === n);
    // Only show the banner once the groups have loaded (otherwise we'd flash it on every mount)
    if (!activeWg && waarneemgroepenLoading) return false;
    return activeWg ? activeWg.idgroep !== GROEP_SECRETARIS : false;
  }, [activeWaarneemgroepId, waarneemgroepen, waarneemgroepenLoading]);

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

  // Only fetch assignment types — exclude preference types (2, 3, 9, 10, 5001)
  // so vakantie preferences never leak into the shift block stripes.
  const ASSIGNMENT_TYPES = useMemo(() => [0, 1, 4, 5, 6, 11], []);

  const { data: dienstenResponse, loading: dienstenLoading, error: dienstenError } = useDienstenSubscription(
    vanGte,
    totLte,
    waarneemgroepIds,
    ASSIGNMENT_TYPES,
    undefined,
    refreshKey
  );

  const allRows = useMemo(() => {
    const blocks = dienstenToShiftBlocks(dienstenResponse ?? null);
    return groupShiftBlocksByWaarneemgroep(blocks);
  }, [dienstenResponse]);

  const idsToShow = useMemo(
    () => (selectedIds !== null ? selectedIds : defaultSelectedIds(activeWaarneemgroepId, waarneemgroepIds)),
    [selectedIds, activeWaarneemgroepId, waarneemgroepIds]
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

  const rows = useMemo(
    () => withWaarneemgroepNames(
      allRows.filter((row) => idsToShow.has(row.id)),
      waarneemgroepNameSource
    ),
    [allRows, idsToShow, waarneemgroepNameSource]
  );

  const selectedWaarneemgroepIds = useMemo(() => Array.from(idsToShow), [idsToShow]);
  const { data: voorkeuren } = useVoorkeurenSubscription(vanGte, totLte, selectedWaarneemgroepIds);

  // Fetch doctors (full DeelnemerWithGroepen) once on mount / when groups change
  useEffect(() => {
    if (!waarneemgroepIds.length) return;
    setDoctorsLoading(true);
    fetch('/api/deelnemers')
      .then((r) => r.json())
      .then((data: {
        deelnemers?: Array<{
          id: number;
          voornaam: string | null;
          achternaam: string | null;
          color: string | null;
          waarneemgroepen: { id: number; naam: string | null; aangemeld: boolean }[];
        }>
      }) => {
        if (data?.deelnemers) {
          setAllDoctors(
            data.deelnemers.map((d) => ({
              id: d.id,
              voornaam: d.voornaam,
              achternaam: d.achternaam,
              color: d.color,
              initials: toInitials(d.voornaam, d.achternaam),
              fullName: toFullName(d.voornaam, d.achternaam),
              waarneemgroepIds: d.waarneemgroepen
                .filter((wg) => wg.aangemeld)
                .map((wg) => wg.id),
            }))
          );
        }
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setDoctorsLoading(false));
  }, [waarneemgroepIds.join(',')]);

  // Filter to only doctors aangemeld in the currently visible waarneemgroepen
  const doctors = useMemo(
    () => allDoctors.filter((d) =>
      d.waarneemgroepIds.some((wgId) => selectedWaarneemgroepIds.includes(wgId))
    ),
    [allDoctors, selectedWaarneemgroepIds]
  );

  // When selected doctor is no longer in the filtered list, deselect
  useEffect(() => {
    if (selectedDoctor && !doctors.some((d) => d.id === selectedDoctor.id)) {
      setSelectedDoctor(null);
    }
  }, [doctors, selectedDoctor]);

  const isActive = selectedDoctor !== null || deleteMode;

  // Floating chip: follow cursor when a doctor is selected or delete mode is active
  useEffect(() => {
    if (!isActive) {
      setDragPosition(null);
      return;
    }
    const offset = 14;
    const onMove = (e: MouseEvent) => setDragPosition({ x: e.clientX + offset, y: e.clientY + offset });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [isActive]);

  // Cancel selection/mode on Escape
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedDoctor(null);
        setDeleteMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive]);

  // Clear when clicking outside sidebar + calendar
  const sidebarRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isActive) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (sidebarRef.current?.contains(t) || calendarRef.current?.contains(t)) return;
      setSelectedDoctor(null);
      setDeleteMode(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isActive]);


  /** Call assign or unassign API, refresh, show toast. */
  const callAssign = useCallback(
    async (block: ShiftBlockView, section: 'top' | 'middle' | 'bottom', iddeelnemer: number | null) => {
      if (isAssigning) return;

      let conflictWarning: string | null = null;
      if (iddeelnemer !== null) {
        const conflictingSections = (['top', 'middle', 'bottom'] as const)
          .filter((s) => s !== section)
          .filter((s) => block[s]?.id === iddeelnemer)
          .map((s) => SECTION_LABEL[s]);

        if (conflictingSections.length > 0) {
          conflictWarning = `al toegewezen als ${conflictingSections.join(' en ')}`;
        }
      }

      setIsAssigning(true);
      try {
        const res = await fetch('/api/diensten/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idwaarneemgroep: block.idwaarneemgroep,
            van: block.van,
            tot: block.tot,
            iddeelnemer,
            section,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data?.error ?? 'Toewijzen mislukt');
          return;
        }
        clearCacheByPrefix('/api/diensten');
        setRefreshKey((k) => k + 1);
        if (iddeelnemer == null) {
          toast.success(`${SECTION_LABEL[section]} ontkoppeld`);
        } else {
          const doc = allDoctors.find((d) => d.id === iddeelnemer);
          const name = doc?.fullName ?? 'Dokter';
          const isNonMember = doc && block.idwaarneemgroep != null && !doc.waarneemgroepIds.includes(block.idwaarneemgroep);
          if (conflictWarning) {
            toast(`${name} toegewezen als ${SECTION_LABEL[section]} (let op: ${conflictWarning})`, {
              style: { background: '#f97316', color: '#fff', border: 'none' },
            });
          } else if (isNonMember) {
            toast(`Let op: ${name} is geen lid van deze waarneemgroep`, {
              style: { background: '#f97316', color: '#fff', border: 'none' },
            });
          } else {
            toast.success(`${name} toegewezen als ${SECTION_LABEL[section]}`);
          }
        }
      } catch {
        toast.error('Netwerkfout bij toewijzen');
      } finally {
        setIsAssigning(false);
      }
    },
    [isAssigning, allDoctors]
  );

  /**
   * Stripe click handler.
   * - Delete mode + stripe filled → unassign
   * - Delete mode + stripe empty → no-op
   * - Doctor selected → assign that doctor (replaces existing)
   * - No mode/doctor → no-op
   */
  const handleSectionShiftClick = useCallback(
    (block: ShiftBlockView, section: 'top' | 'middle' | 'bottom') => {
      if (isAssigning) return;
      const currentDoctor = section === 'top' ? block.top : section === 'bottom' ? block.bottom : block.middle;
      if (deleteMode) {
        if (currentDoctor) void callAssign(block, section, null);
        // else: delete mode but stripe is empty → nothing to do
      } else if (selectedDoctor) {
        void callAssign(block, section, selectedDoctor.id);
      }
    },
    [selectedDoctor, deleteMode, isAssigning, callAssign]
  );

  const loading = waarneemgroepenLoading || (waarneemgroepIds.length > 0 && dienstenLoading);
  const error = waarneemgroepenError ?? dienstenError;

  return (
    <>
      <Head>
        <title>Rooster maken secretaris | Doktersdienst</title>
      </Head>

      {/* Floating chip following cursor */}
      {dragPosition && deleteMode && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: dragPosition.x,
            top: dragPosition.y,
            pointerEvents: 'none',
            zIndex: 99999,
            transform: 'translate(-50%, -50%)',
            padding: '6px 8px',
            borderRadius: 6,
            backgroundColor: '#ef4444',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </div>
      )}
      {dragPosition && selectedDoctor && !deleteMode && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: dragPosition.x,
            top: dragPosition.y,
            pointerEvents: 'none',
            zIndex: 99999,
            transform: 'translate(-50%, -50%)',
            padding: '4px 10px',
            borderRadius: 6,
            backgroundColor: selectedDoctor.color ?? '#6b7280',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 13,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          {selectedDoctor.initials}
        </div>
      )}

      <div className="mx-auto max-w-[2000px] space-y-6 px-4 py-8">
        <Card className="overflow-visible">
          <CardHeader className="overflow-visible">
            <CardTitle>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <FilterPopover
                  waarneemgroepen={secretarisWaarneemgroepen}
                  loading={waarneemgroepenLoading}
                  idsToShow={idsToShow}
                  totalCount={secretarisWaarneemgroepen.length}
                  onToggle={toggleWaarneemgroep}
                />
                Rooster maken <InfoPopover />
              </h1>
            </CardTitle>
          </CardHeader>
          {isActiveGroupForbidden && (
            <CardContent>
              <p className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800" role="alert">
                U bent geen secretaris voor deze waarneemgroep, kies een andere waarneemgroep.
              </p>
            </CardContent>
          )}
        </Card>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Doctor sidebar */}
          <div ref={sidebarRef} className="sticky top-6 w-full shrink-0 self-start lg:w-56">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dokters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-3 pt-0">
                {/* Trash / delete mode button */}
                <button
                  type="button"
                  onClick={() => {
                    setDeleteMode((prev) => !prev);
                    setSelectedDoctor(null);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    deleteMode
                      ? 'bg-destructive/10 text-destructive outline-2 outline-destructive'
                      : 'hover:bg-accent text-muted-foreground'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${
                      deleteMode ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Trash2 size={13} />
                  </span>
                  <span className={`truncate ${deleteMode ? 'font-semibold' : ''}`}>Verwijderen</span>
                  {deleteMode && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-destructive" />}
                </button>

                <div className="my-1 border-t border-border" />

                {doctorsLoading && (
                  <p className="px-1 text-sm text-muted-foreground">Laden…</p>
                )}
                {!doctorsLoading && doctors.length === 0 && (
                  <p className="px-1 text-sm text-muted-foreground">Geen dokters gevonden.</p>
                )}
                {!doctorsLoading && doctors.map((doctor) => {
                  const isSelected = selectedDoctor?.id === doctor.id;
                  const groupBadges = idsToShow.size > 1
                    ? (waarneemgroepen ?? []).filter(
                        (wg) => wg.ID != null && idsToShow.has(wg.ID) && doctor.waarneemgroepIds.includes(wg.ID)
                      )
                    : [];
                  return (
                    <button
                      key={doctor.id}
                      type="button"
                      onClick={() => {
                        setSelectedDoctor(isSelected ? null : doctor);
                        setDeleteMode(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        isSelected ? 'bg-accent' : 'hover:bg-accent'
                      }`}
                      style={isSelected ? { outline: `2px solid ${doctor.color ?? '#6b7280'}`, outlineOffset: '1px' } : undefined}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white"
                        style={{ backgroundColor: doctor.color ?? '#6b7280' }}
                      >
                        {doctor.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate ${isSelected ? 'font-semibold' : ''}`}>
                          {doctor.fullName}
                        </span>
                        {groupBadges.length > 0 && (
                          <span className="mt-0.5 flex flex-wrap gap-1">
                            {groupBadges.map((wg) => (
                              <span
                                key={wg.ID}
                                className="rounded bg-muted px-1 py-0.5 text-[10px] leading-none text-muted-foreground"
                              >
                                {wg.naam ?? `#${wg.ID}`}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <span className="mt-1 ml-auto h-2 w-2 shrink-0 self-start rounded-full bg-green-500" />
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Status hint */}
            <div className="mt-3 space-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              {deleteMode ? (
                <>
                  <p className="font-medium text-destructive">
                    Verwijdermodus{isAssigning ? ' — bezig…' : '. Klik op een bezette stripe.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDeleteMode(false)}
                    className="text-destructive underline-offset-2 hover:underline"
                  >
                    Annuleren (Esc)
                  </button>
                </>
              ) : selectedDoctor ? (
                <>
                  <p>
                    <span className="font-medium text-foreground">{selectedDoctor.fullName}</span> geselecteerd
                    {isAssigning ? ' — bezig…' : '. Klik op een stripe.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedDoctor(null)}
                    className="text-destructive underline-offset-2 hover:underline"
                  >
                    Annuleren (Esc)
                  </button>
                </>
              ) : (
                <p>Selecteer een dokter of verwijdermodus om toe te wijzen.</p>
              )}
            </div>
          </div>

          {/* Calendar */}
          <Card className="min-w-0 flex-1">
            <CardHeader>
              
            </CardHeader>
            <CardContent>
              {error && (
                <p className="mb-4 text-sm text-destructive" role="alert">{error}</p>
              )}
              {loading && !dienstenResponse && (
                <p className="mb-4 text-sm text-muted-foreground">Rooster laden…</p>
              )}
              <div ref={calendarRef}>
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
                  onSectionShiftClick={handleSectionShiftClick}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
