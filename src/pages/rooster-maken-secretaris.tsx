'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { CalendarGridWithNavState } from '@/components/CalandarGrid/CalendarGridWithNavState';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { dienstenToShiftBlocks, groupShiftBlocksByWaarneemgroep, withWaarneemgroepNames } from '@/hooks/useDienstenSchedule';
import { useDienstenSubscription, clearCacheByPrefix } from '@/hooks/useDienstenSubscription';
import { useVoorkeurenSubscription } from '@/hooks/useVoorkeurenSubscription';
import type { ShiftBlockView } from '@/types/diensten';
import type { ChipDefinition } from '@/types/voorkeuren';
import { CHIP_DEFINITIONS } from '@/types/voorkeuren';

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
}

function toInitials(voornaam: string | null, achternaam: string | null): string {
  return ((voornaam?.[0] ?? '') + (achternaam?.[0] ?? '')).toUpperCase();
}

function toFullName(voornaam: string | null, achternaam: string | null): string {
  return [voornaam, achternaam].filter(Boolean).join(' ') || 'Onbekend';
}

export default function RoosterMakenSecretarisPage() {
  const { data: session } = authClient.useSession();
  const { activeWaarneemgroepId, waarneemgroepen, loading: waarneemgroepenLoading, error: waarneemgroepenError } = useWaarneemgroep();

  const now = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  // Doctors sidebar state
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);

  // Mutation feedback
  const [assignError, setAssignError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
    waarneemgroepIds,
    undefined,
    undefined,
    refreshKey
  );

  const allRows = useMemo(() => {
    const blocks = dienstenToShiftBlocks(dienstenResponse ?? null);
    return groupShiftBlocksByWaarneemgroep(blocks);
  }, [dienstenResponse]);

  // Show all accessible waarneemgroepen (use activeWaarneemgroepId as default selection)
  const idsToShow = useMemo(() => {
    if (!waarneemgroepIds.length) return new Set<number>();
    if (activeWaarneemgroepId) {
      const n = Number(activeWaarneemgroepId);
      if (!Number.isNaN(n)) return new Set([n]);
    }
    return new Set(waarneemgroepIds);
  }, [waarneemgroepIds, activeWaarneemgroepId]);

  const rows = useMemo(
    () => withWaarneemgroepNames(
      allRows.filter((row) => idsToShow.has(row.id)),
      waarneemgroepNameSource
    ),
    [allRows, idsToShow, waarneemgroepNameSource]
  );

  const selectedWaarneemgroepIds = useMemo(() => Array.from(idsToShow), [idsToShow]);
  const { data: voorkeuren } = useVoorkeurenSubscription(vanGte, totLte, selectedWaarneemgroepIds);

  // Fetch doctors for the visible waarneemgroepen
  useEffect(() => {
    if (!waarneemgroepIds.length) return;
    setDoctorsLoading(true);
    fetch('/api/deelnemers')
      .then((r) => r.json())
      .then((data) => {
        if (data?.deelnemers) {
          setDoctors(
            (data.deelnemers as Array<{ id: number; voornaam: string | null; achternaam: string | null; color: string | null }>).map((d) => ({
              id: d.id,
              voornaam: d.voornaam,
              achternaam: d.achternaam,
              color: d.color,
              initials: toInitials(d.voornaam, d.achternaam),
              fullName: toFullName(d.voornaam, d.achternaam),
            }))
          );
        }
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setDoctorsLoading(false));
  }, [waarneemgroepIds]);

  // Floating chip: follow cursor when a doctor is selected
  useEffect(() => {
    if (!selectedDoctor) {
      setDragPosition(null);
      return;
    }
    const offset = 14;
    const onMove = (e: MouseEvent) => setDragPosition({ x: e.clientX + offset, y: e.clientY + offset });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [selectedDoctor]);

  // Cancel selection on Escape
  useEffect(() => {
    if (!selectedDoctor) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedDoctor(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedDoctor]);

  // Deselect doctor when clicking outside sidebar + calendar
  const sidebarRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedDoctor) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (sidebarRef.current?.contains(t) || calendarRef.current?.contains(t)) return;
      setSelectedDoctor(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [selectedDoctor]);

  // Preference map for the selected doctor: van_tot → ChipDefinition
  const plannerDoctorPreferenceMap = useMemo<Map<string, ChipDefinition> | undefined>(() => {
    if (!selectedDoctor || !voorkeuren?.length) return undefined;
    const map = new Map<string, ChipDefinition>();
    for (const vk of voorkeuren) {
      if (vk.iddeelnemer !== selectedDoctor.id) continue;
      const chip = CHIP_DEFINITIONS.find((c) => c.code === String(vk.type ?? ''));
      if (chip) map.set(`${vk.van}_${vk.tot}`, chip);
    }
    return map.size > 0 ? map : undefined;
  }, [selectedDoctor, voorkeuren]);

  // Assign a doctor to a shift section by calling the API immediately
  const handleSectionShiftClick = useCallback(
    async (block: ShiftBlockView, section: 'top' | 'middle' | 'bottom') => {
      if (!selectedDoctor) return;
      setAssignError(null);
      try {
        const res = await fetch('/api/diensten/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idwaarneemgroep: block.idwaarneemgroep,
            van: block.van,
            tot: block.tot,
            iddeelnemer: selectedDoctor.id,
            section,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setAssignError(data?.error ?? 'Toewijzen mislukt');
          return;
        }
        // Clear cache and trigger re-fetch
        clearCacheByPrefix('/api/diensten');
        setRefreshKey((k) => k + 1);
      } catch {
        setAssignError('Netwerkfout bij toewijzen');
      }
    },
    [selectedDoctor]
  );

  const loading = waarneemgroepenLoading || (waarneemgroepIds.length > 0 && dienstenLoading);
  const error = waarneemgroepenError ?? dienstenError;

  return (
    <>
      <Head>
        <title>Rooster maken secretaris | Doktersdienst</title>
      </Head>

      {/* Floating chip following cursor */}
      {selectedDoctor && dragPosition && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: dragPosition.x,
            top: dragPosition.y,
            pointerEvents: 'none',
            zIndex: 9999,
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
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl font-semibold tracking-tight">
                Rooster maken
              </h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Selecteer een dokter uit de lijst en klik daarna op een dienst om toe te wijzen. Druk op <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-xs font-mono">Esc</kbd> om de selectie te annuleren.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Doctor sidebar */}
          <div ref={sidebarRef} className="sticky top-6 w-full shrink-0 self-start lg:w-56">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dokters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-3 pt-0">
                {doctorsLoading && (
                  <p className="text-sm text-muted-foreground px-1">Laden…</p>
                )}
                {!doctorsLoading && doctors.length === 0 && (
                  <p className="text-sm text-muted-foreground px-1">Geen dokters gevonden.</p>
                )}
                {!doctorsLoading && doctors.map((doctor) => {
                  const isSelected = selectedDoctor?.id === doctor.id;
                  return (
                    <button
                      key={doctor.id}
                      type="button"
                      onClick={() => setSelectedDoctor(isSelected ? null : doctor)}
                      className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-accent'
                          : 'hover:bg-accent'
                      }`}
                      style={isSelected ? { outline: `2px solid ${doctor.color ?? '#6b7280'}`, outlineOffset: '1px' } : undefined}
                    >
                      {/* Color badge */}
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: doctor.color ?? '#6b7280' }}
                      >
                        {doctor.initials}
                      </span>
                      <span className={`truncate ${isSelected ? 'font-semibold' : ''}`}>
                        {doctor.fullName}
                      </span>
                      {isSelected && (
                        <span className="ml-auto shrink-0 h-2 w-2 rounded-full bg-green-500" title="Geselecteerd" />
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {selectedDoctor && (
              <div className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{selectedDoctor.fullName}</span> geselecteerd.{' '}
                Klik op een dienst om toe te wijzen.
                <br />
                <button
                  type="button"
                  onClick={() => setSelectedDoctor(null)}
                  className="mt-1 text-destructive underline-offset-2 hover:underline"
                >
                  Annuleren (Esc)
                </button>
              </div>
            )}
          </div>

          {/* Calendar */}
          <Card className="min-w-0 flex-1">
            <CardHeader>
              <CardTitle>Kalenderoverzicht</CardTitle>
            </CardHeader>
            <CardContent>
              {(error || assignError) && (
                <p className="mb-4 text-destructive text-sm" role="alert">
                  {assignError ?? error}
                </p>
              )}
              {loading && !dienstenResponse && (
                <p className="mb-4 text-muted-foreground text-sm">Rooster laden…</p>
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
                  onSectionShiftClick={selectedDoctor ? handleSectionShiftClick : undefined}
                  plannerDoctorPreferenceMap={plannerDoctorPreferenceMap}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
