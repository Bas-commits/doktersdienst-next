'use client';

import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import type { VakantiesResponse, VakantieItem } from './api/vakanties/index';

const TYPE_FEESTDAG = 0;
const TYPE_VAKANTIE = 1;

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50';

function formatDateTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateTimeLocal(unix: number): string {
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocal(value: string): number {
  if (!value) return 0;
  return Math.floor(new Date(value).getTime() / 1000);
}

function todayStart(): string {
  const d = new Date();
  return toDateTimeLocal(Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0).getTime() / 1000));
}

function todayEnd(): string {
  const d = new Date();
  return toDateTimeLocal(Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59).getTime() / 1000));
}

export default function VakantiePage() {
  const { data: session, isPending } = authClient.useSession();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const [data, setData] = useState<VakantiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [naam, setNaam] = useState('');
  const [idvakantieregio, setIdvakantieregio] = useState('0');
  const [type, setType] = useState<0 | 1>(TYPE_VAKANTIE);
  const [van, setVan] = useState(todayStart);
  const [tot, setTot] = useState(todayEnd);
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<VakantieItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback((y: number) => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/vakanties?year=${y}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d: VakantiesResponse & { error?: string }) => {
        if (d.error) { setLoadError(d.error); return; }
        setData(d);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Laden mislukt'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    loadData(year);
  }, [session?.user, year, loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naam.trim()) {
      toast.error('Vul een naam in.');
      return;
    }
    const vanUnix = fromDateTimeLocal(van);
    const totUnix = fromDateTimeLocal(tot);
    if (!vanUnix) {
      toast.error('Vul een geldige Van-datum in.');
      return;
    }
    if (!totUnix) {
      toast.error('Vul een geldige Tot-datum in.');
      return;
    }
    if (totUnix < vanUnix) {
      toast.error('Tot moet na Van liggen.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/vakanties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          naam: naam.trim(),
          idvakantieregio: parseInt(idvakantieregio, 10) || 0,
          van: vanUnix,
          tot: totUnix,
          type,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? 'Toevoegen mislukt.');
        return;
      }
      toast.success('Vakantie toegevoegd.');
      setNaam('');
      // Reload to show new entry (keep van/tot as-is like the original)
      loadData(year);
    } catch {
      toast.error('Toevoegen mislukt. Probeer het opnieuw.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/vakanties/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? 'Verwijderen mislukt.');
        return;
      }
      toast.success(`"${deleteTarget.naam}" verwijderd.`);
      setDeleteTarget(null);
      loadData(year);
    } catch {
      toast.error('Verwijderen mislukt. Probeer het opnieuw.');
    } finally {
      setDeleting(false);
    }
  };

  const regioLabel = (vak: VakantieItem) =>
    vak.regio_naam && vak.regio_naam.trim().length > 0 ? vak.regio_naam : 'Alle';
  const typeLabel = (t: number) => (t === TYPE_FEESTDAG ? 'Feestdag' : 'Vakantie');

  if (isPending || !session?.user) return null;

  return (
    <>
      <Head>
        <title>Vakanties | Doktersdienst</title>
      </Head>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { if (!deleting) setDeleteTarget(null); }}
        >
          <div
            className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold">Vakantie verwijderen</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Weet u zeker dat u{' '}
              <span className="font-medium text-foreground">{deleteTarget.naam}</span>{' '}
              (ID: {deleteTarget.id}) wilt verwijderen?
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Annuleren
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Bezig…' : 'Verwijderen'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vakantie toevoegen</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gegevens nieuwe vakantie</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="vak-naam">
                  Naam <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vak-naam"
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  placeholder="Naam van de vakantie of feestdag"
                  disabled={submitting}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="vak-regio">Vakantieregio</Label>
                <select
                  id="vak-regio"
                  className={selectClass}
                  value={idvakantieregio}
                  onChange={(e) => setIdvakantieregio(e.target.value)}
                  disabled={submitting}
                >
                  <option value="0">Alle regio's</option>
                  {data?.vakantieregios.map((r) => (
                    <option key={r.id} value={String(r.id)}>{r.naam}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Type</span>
                <div className="flex gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="vak-type"
                      checked={type === TYPE_FEESTDAG}
                      onChange={() => setType(TYPE_FEESTDAG)}
                      disabled={submitting}
                    />
                    Feestdag
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="vak-type"
                      checked={type === TYPE_VAKANTIE}
                      onChange={() => setType(TYPE_VAKANTIE)}
                      disabled={submitting}
                    />
                    Vakantie
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="vak-van">
                    Van <span className="text-destructive">*</span>
                  </Label>
                  <DateTimePicker
                    id="vak-van"
                    value={van}
                    onChange={setVan}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vak-tot">
                    Tot <span className="text-destructive">*</span>
                  </Label>
                  <DateTimePicker
                    id="vak-tot"
                    value={tot}
                    onChange={setTot}
                    disabled={submitting}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Einde van de feestdag altijd als 23:59 opgeven.
              </p>

              <div>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Bezig…' : 'Toevoegen'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Year-filtered table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              Ingevoerde vakanties en feestdagen {year}
            </h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setYear((y) => y - 1)}
              >
                &laquo; Eerder
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setYear((y) => y + 1)}
              >
                Later &raquo;
              </Button>
            </div>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Laden…</p>}
          {loadError && <p className="text-sm text-destructive" role="alert">{loadError}</p>}

          {!loading && !loadError && (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pt-3 px-4 font-medium w-14">ID</th>
                    <th className="pb-2 pt-3 px-4 font-medium w-24">Regio</th>
                    <th className="pb-2 pt-3 px-4 font-medium">Naam</th>
                    <th className="pb-2 pt-3 px-4 font-medium">Van</th>
                    <th className="pb-2 pt-3 px-4 font-medium">Tot</th>
                    <th className="pb-2 pt-3 px-4 font-medium w-24">Type</th>
                    <th className="pb-2 pt-3 px-4 font-medium w-28" />
                  </tr>
                </thead>
                <tbody>
                  {(data?.vakanties ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-muted-foreground">
                        Geen vakanties of feestdagen in {year}.
                      </td>
                    </tr>
                  ) : (
                    data!.vakanties.map((vak) => (
                      <tr key={vak.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-2.5 text-muted-foreground">{vak.id}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{regioLabel(vak)}</td>
                        <td className="px-4 py-2.5 font-medium">{vak.naam}</td>
                        <td className="px-4 py-2.5">{formatDateTime(vak.van)}</td>
                        <td className="px-4 py-2.5">{formatDateTime(vak.tot)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{typeLabel(vak.type)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(vak)}
                            aria-label={`Vakantie ${vak.naam} verwijderen`}
                          >
                            Verwijderen
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
