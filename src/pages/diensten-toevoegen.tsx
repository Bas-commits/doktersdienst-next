'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { CalendarGridWithNavState } from '@/components/CalandarGrid/CalendarGridWithNavState';
import { dienstenToShiftBlocks, groupShiftBlocksByWaarneemgroep } from '@/hooks/useDienstenSchedule';
import { useDienstenSubscription, clearCacheByPrefix } from '@/hooks/useDienstenSubscription';
import { useCalendarVakanties } from '@/hooks/useCalendarVakanties';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import type { ShiftBlockView } from '@/types/diensten';

const TWO_WEEKS_SECONDS = 14 * 24 * 60 * 60;

function vanGteForMonth(viewMonth: number, viewYear: number): number {
  return Math.floor(new Date(viewYear, viewMonth, 1, 0, 0, 0, 0).getTime() / 1000) - TWO_WEEKS_SECONDS;
}

function totLteForMonth(viewMonth: number, viewYear: number): number {
  return Math.floor(new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999).getTime() / 1000) + TWO_WEEKS_SECONDS;
}

function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateTimeLocalToLocalString(s: string): string {
  // "2024-03-15T08:00" → "2024-03-15 08:00:00"
  if (!s || s.length < 16) return '';
  return s.slice(0, 10) + ' ' + s.slice(11, 16) + ':00';
}

function todayDateString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function twoYearsLaterDateString(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface AantekeningOption {
  id: number;
  tekst: string | null;
  idtariefDefault: number | null;
}

interface TariefOption {
  id: number;
  omschrijving: string;
}

const selectClassName =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

export default function DienstenToevoegenPage() {
  authClient.useSession();
  const { activeWaarneemgroepId, activeWaarneemgroep, loading: groepLoading } = useWaarneemgroep();

  const now = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const calendarVakanties = useCalendarVakanties(viewYear);
  const [refreshKey, setRefreshKey] = useState(0);

  // Form state
  const defaultVan = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return toDateTimeLocal(d);
  }, []);
  const defaultTot = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + 8, 0, 0, 0);
    return toDateTimeLocal(d);
  }, []);

  const [van, setVan] = useState(defaultVan);
  const [tot, setTot] = useState(defaultTot);
  const [aantekeningId, setAantekeningId] = useState('0');
  const [nieuweAant, setNieuweAant] = useState('');
  const [tariefId, setTariefId] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  // Options (aantekeningen + tarieven)
  const [aantekeningen, setAantekeningen] = useState<AantekeningOption[]>([]);
  const [tarieven, setTarieven] = useState<TariefOption[]>([]);

  useEffect(() => {
    if (!activeWaarneemgroepId) return;
    fetch(`/api/diensten/options?idwaarneemgroep=${activeWaarneemgroepId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.aantekeningen) setAantekeningen(data.aantekeningen);
        if (data.tarieven) setTarieven(data.tarieven);
      })
      .catch(() => {});
  }, [activeWaarneemgroepId]);

  // Auto-select default tarief when aantekening changes
  useEffect(() => {
    const id = parseInt(aantekeningId, 10);
    const aant = aantekeningen.find((a) => a.id === id);
    if (aant?.idtariefDefault && aant.idtariefDefault > 0) {
      if (tarieven.some((t) => t.id === aant.idtariefDefault)) {
        setTariefId(String(aant.idtariefDefault));
      }
    }
  }, [aantekeningId, aantekeningen, tarieven]);

  // Herhalen dialog state
  const [herhalenOpen, setHerhalenOpen] = useState(false);
  const [weken, setWeken] = useState(1);
  const [startDatum, setStartDatum] = useState(todayDateString);
  const [eindDatum, setEindDatum] = useState(twoYearsLaterDateString);

  // Delete dialog state
  const [deleteBlock, setDeleteBlock] = useState<ShiftBlockView | null>(null);
  const [deleteChoice, setDeleteChoice] = useState<'single' | 'future'>('single');
  const [recurrenceInfo, setRecurrenceInfo] = useState<{
    has_recurrence: boolean;
    future_count?: number;
    last_van?: number;
  } | null>(null);
  const [recurrenceLoading, setRecurrenceLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!deleteBlock) {
      setRecurrenceInfo(null);
      return;
    }
    setRecurrenceLoading(true);
    const params = new URLSearchParams({
      van: String(deleteBlock.van),
      tot: String(deleteBlock.tot),
      idwaarneemgroep: String(deleteBlock.idwaarneemgroep ?? ''),
    });
    fetch(`/api/diensten/recurrence-info?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setRecurrenceInfo(data);
        setRecurrenceLoading(false);
      })
      .catch(() => {
        setRecurrenceInfo({ has_recurrence: false });
        setRecurrenceLoading(false);
      });
  }, [deleteBlock]);

  // Fetch type=1 shifts for calendar
  const waarneemgroepIds = useMemo(() => {
    if (!activeWaarneemgroepId) return [];
    const id = Number(activeWaarneemgroepId);
    return Number.isNaN(id) ? [] : [id];
  }, [activeWaarneemgroepId]);

  const vanGte = useMemo(() => vanGteForMonth(viewMonth, viewYear), [viewMonth, viewYear]);
  const totLte = useMemo(() => totLteForMonth(viewMonth, viewYear), [viewMonth, viewYear]);

  const { data: dienstenResponse, error: dienstenError } = useDienstenSubscription(
    vanGte,
    totLte,
    waarneemgroepIds,
    [1],
    undefined,
    refreshKey
  );

  const rows = useMemo(() => {
    const blocks = dienstenToShiftBlocks(dienstenResponse ?? null);
    const grouped = groupShiftBlocksByWaarneemgroep(blocks);
    return grouped.map((row) => ({
      ...row,
      name: activeWaarneemgroep?.naam ?? row.name,
    }));
  }, [dienstenResponse, activeWaarneemgroep?.naam]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent, withHerhalen = false) => {
      e.preventDefault();
      if (!activeWaarneemgroepId) {
        toast.error('Geen waarneemgroep geselecteerd.');
        return;
      }
      const vanStr = dateTimeLocalToLocalString(van);
      const totStr = dateTimeLocalToLocalString(tot);
      if (!vanStr || !totStr) {
        toast.error('Vul geldige Van- en Tot-datum/tijd in.');
        return;
      }

      setSubmitting(true);
      try {
        const body: Record<string, unknown> = {
          van: vanStr,
          tot: totStr,
          idwaarneemgroep: Number(activeWaarneemgroepId),
          idaantekening: parseInt(aantekeningId, 10) || 0,
          idtarief: parseInt(tariefId, 10) || 0,
          nieuweaant: nieuweAant.trim() || undefined,
        };

        if (withHerhalen) {
          const startTs = Math.floor(new Date(startDatum + 'T00:00:00').getTime() / 1000);
          const endTs = Math.floor(new Date(eindDatum + 'T23:59:59').getTime() / 1000) + 86400;
          if (endTs <= startTs) {
            toast.error('Einddatum moet na startdatum liggen.');
            setSubmitting(false);
            return;
          }
          body.herhalen = true;
          body.weken = Math.max(1, Math.min(52, weken));
          body.startdatum = startTs;
          body.einddatum = endTs;
        }

        const res = await fetch('/api/diensten/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        });
        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error ?? 'Opslaan mislukt.');
        } else {
          toast.success(data.message ?? 'Shift toegevoegd.');
          setNieuweAant('');
          setHerhalenOpen(false);
          clearCacheByPrefix('/api/diensten');
          setRefreshKey((k) => k + 1);
        }
      } catch {
        toast.error('Opslaan mislukt. Probeer het opnieuw.');
      } finally {
        setSubmitting(false);
      }
    },
    [activeWaarneemgroepId, van, tot, aantekeningId, tariefId, nieuweAant, weken, startDatum, eindDatum]
  );


  const handleShiftDelete = useCallback((block: ShiftBlockView) => {
    setDeleteBlock(block);
    setDeleteChoice('single');
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteBlock) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/diensten/delete-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          van: deleteBlock.van,
          tot: deleteBlock.tot,
          idwaarneemgroep: deleteBlock.idwaarneemgroep,
          delete_future_recurrences: recurrenceInfo?.has_recurrence && deleteChoice === 'future',
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Verwijderen mislukt.');
      } else {
        toast.success(data.message ?? 'Shift verwijderd.');
        setDeleteBlock(null);
        setDeleteChoice('single');
        setRecurrenceInfo(null);
        clearCacheByPrefix('/api/diensten');
        setRefreshKey((k) => k + 1);
      }
    } catch {
      toast.error('Verwijderen mislukt. Probeer het opnieuw.');
    } finally {
      setDeleting(false);
    }
  }, [deleteBlock, recurrenceInfo, deleteChoice]);

  const hasRecurrence = recurrenceInfo?.has_recurrence === true;

  return (
    <>
      <Head>
        <title>Diensten toevoegen | Doktersdienst</title>
      </Head>

      {/* Herhalen dialog */}
      {herhalenOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setHerhalenOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold">Gegevens herhaling</h2>
            <form
              onSubmit={(e) => handleSubmit(e, true)}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="herhalen-weken">Iedere hoeveel weken herhalen</Label>
                <Input
                  id="herhalen-weken"
                  type="number"
                  min={1}
                  max={52}
                  value={weken}
                  onChange={(e) => setWeken(parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="herhalen-startdatum">Startdatum frame</Label>
                <Input
                  id="herhalen-startdatum"
                  type="date"
                  value={startDatum}
                  onChange={(e) => setStartDatum(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="herhalen-einddatum">Einddatum frame</Label>
                <Input
                  id="herhalen-einddatum"
                  type="date"
                  value={eindDatum}
                  onChange={(e) => setEindDatum(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setHerhalenOpen(false)}
                  disabled={submitting}
                >
                  Annuleren
                </Button>
                <Button type="submit" disabled={submitting}>
                  Verzenden
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteBlock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => {
            setDeleteBlock(null);
            setDeleteChoice('single');
            setRecurrenceInfo(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold">Shift verwijderen</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Weet u zeker dat u deze shift wilt verwijderen? ({deleteBlock.startTime} – {deleteBlock.endTime})
            </p>

            {(recurrenceLoading || hasRecurrence) && (
              <div className="mb-4 rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">Bereik</p>
                {recurrenceLoading ? (
                  <p className="text-sm text-muted-foreground">Herhalingsgegevens laden…</p>
                ) : (
                  <>
                    {recurrenceInfo?.future_count != null && recurrenceInfo.future_count > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {recurrenceInfo.future_count === 1
                          ? 'Er is 1 toekomstige herhaling.'
                          : `Er zijn ${recurrenceInfo.future_count} toekomstige herhalingen.`}
                        {recurrenceInfo.last_van != null && (
                          <>
                            {' '}Laatste op{' '}
                            {new Date(recurrenceInfo.last_van * 1000).toLocaleDateString('nl-NL', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                            .
                          </>
                        )}
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="delete-scope"
                          value="single"
                          checked={deleteChoice === 'single'}
                          onChange={() => setDeleteChoice('single')}
                        />
                        Alleen deze shift
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="delete-scope"
                          value="future"
                          checked={deleteChoice === 'future'}
                          onChange={() => setDeleteChoice('future')}
                        />
                        Deze shift en alle toekomstige herhalingen
                        {recurrenceInfo?.future_count != null && recurrenceInfo.future_count > 0
                          ? ` (${recurrenceInfo.future_count})`
                          : ''}
                      </label>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteBlock(null);
                  setDeleteChoice('single');
                  setRecurrenceInfo(null);
                }}
                disabled={deleting}
              >
                Annuleren
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleting || recurrenceLoading}
              >
                Verwijderen
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[2000px] space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl font-semibold tracking-tight">Diensten toevoegen</h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Voeg een nieuwe dienst (type 1 slot) toe aan de roostering voor de geselecteerde waarneemgroep.
              {activeWaarneemgroep
                ? ` Huidige groep: ${activeWaarneemgroep.naam}.`
                : ' Selecteer een waarneemgroep in de header.'}
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Card className="shrink-0 lg:w-[340px]">
            <CardHeader>
              <CardTitle className="text-base">Gegevens nieuwe dienst</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => handleSubmit(e, false)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="dienst-van">Van</Label>
                  <DateTimePicker
                    id="dienst-van"
                    value={van}
                    onChange={setVan}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dienst-tot">Tot</Label>
                  <DateTimePicker
                    id="dienst-tot"
                    value={tot}
                    onChange={setTot}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dienst-aantekening">Aantekening</Label>
                  <select
                    id="dienst-aantekening"
                    value={aantekeningId}
                    onChange={(e) => setAantekeningId(e.target.value)}
                    disabled={submitting}
                    className={selectClassName}
                  >
                    <option value="0">Geen</option>
                    {aantekeningen.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.tekst ?? `#${a.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dienst-nieuweaant">
                    Nieuwe aantekening{' '}
                    <span className="text-xs text-destructive">(alleen als bestaande niet voldoen)</span>
                  </Label>
                  <Input
                    id="dienst-nieuweaant"
                    type="text"
                    value={nieuweAant}
                    onChange={(e) => setNieuweAant(e.target.value)}
                    disabled={submitting}
                    placeholder="Optioneel"
                  />
                </div>

                {tarieven.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="dienst-tarief">Tarief</Label>
                    <select
                      id="dienst-tarief"
                      value={tariefId}
                      onChange={(e) => setTariefId(e.target.value)}
                      disabled={submitting}
                      className={selectClassName}
                    >
                      <option value="0">Geen</option>
                      {tarieven.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.omschrijving}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" disabled={submitting || groepLoading || !activeWaarneemgroepId}>
                    Verzenden
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setHerhalenOpen(true)}
                    disabled={submitting || groepLoading || !activeWaarneemgroepId}
                  >
                    Herhalen
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="min-w-0 flex-1">
            <CardHeader>
              <CardTitle>
                {activeWaarneemgroep
                  ? `Bestaande diensten – ${activeWaarneemgroep.naam}`
                  : 'Bestaande diensten'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dienstenError && (
                <p className="mb-4 text-destructive" role="alert">
                  {dienstenError}
                </p>
              )}
              {!activeWaarneemgroepId && !groepLoading && (
                <p className="mb-4 text-muted-foreground">
                  Selecteer een waarneemgroep in de header om bestaande diensten te zien.
                </p>
              )}
              {waarneemgroepIds.length > 0 && (
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
                  onShiftDelete={handleShiftDelete}
                  showPreferences={false}
                  vakanties={calendarVakanties}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
