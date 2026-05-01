'use client';

import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { DeelnemerWithGroepen } from './api/deelnemers/index';

/** Matches `GROEP_ADMINISTRATOR` in api-auth (admin deelnemer). */
const GROEP_ADMINISTRATOR = 5;

function formatNaam(d: DeelnemerWithGroepen): string {
  return [d.voornaam, d.voorletterstussenvoegsel, d.achternaam]
    .filter(Boolean)
    .join(' ');
}

export default function DeelnemersVerwijderenPage() {
  const { data: session, isPending } = authClient.useSession();

  const [deelnemers, setDeelnemers] = useState<DeelnemerWithGroepen[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allWaarneemgroepen, setAllWaarneemgroepen] = useState<{ id: number; naam: string | null }[]>([]);
  const [filterWgId, setFilterWgId] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<DeelnemerWithGroepen | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [confirmLoginInput, setConfirmLoginInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const currentDeelnemerId = session?.user?.id != null ? Number(session.user.id) : NaN;

  async function fetchDeelnemers(wgId?: number) {
    setLoading(true);
    setError(null);
    try {
      const url = wgId ? `/api/deelnemers?idwaarneemgroep=${wgId}` : '/api/deelnemers';
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setDeelnemers(data.deelnemers ?? []);
      setIsAdmin(data.isAdmin ?? false);
      setAllWaarneemgroepen(data.allWaarneemgroepen ?? []);
    } catch {
      setError('Kon deelnemers niet laden');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.user) return;
    fetchDeelnemers();
  }, [session?.user]);

  function handleFilterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value === '' ? '' : Number(e.target.value);
    setFilterWgId(val);
    fetchDeelnemers(val === '' ? undefined : (val as number));
  }

  function openConfirm(d: DeelnemerWithGroepen) {
    setPending(d);
    setUnderstood(false);
    setConfirmLoginInput('');
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    setPending(null);
    setUnderstood(false);
    setConfirmLoginInput('');
  }

  const expectedLoginNorm = (pending?.login ?? '').trim();
  const confirmInputNorm = confirmLoginInput.trim();
  const loginMatches =
    expectedLoginNorm.length > 0 && confirmInputNorm === expectedLoginNorm;
  const canSubmitDelete = understood && loginMatches && !deleting;

  async function handleDeleteConfirmed() {
    if (!pending || !canSubmitDelete) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/deelnemers/verwijderen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ iddeelnemer: pending.id }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      toast.success('Deelnemer verwijderd.');
      setDeelnemers((prev) => prev.filter((x) => x.id !== pending.id));
      closeDialog();
    } catch {
      toast.error('Verwijderen mislukt.');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deelnemers;
    return deelnemers.filter((d) => {
      const naam = formatNaam(d).toLowerCase();
      const login = (d.login ?? '').toLowerCase();
      const wgnamen = d.waarneemgroepen.map((wg) => (wg.naam ?? '').toLowerCase()).join(' ');
      return naam.includes(q) || login.includes(q) || wgnamen.includes(q);
    });
  }, [deelnemers, search]);

  const showWaarneemgroepColumn =
    allWaarneemgroepen.length > 1 || (!isAdmin && deelnemers.some((d) => d.waarneemgroepen.length > 0));

  if (isPending) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Laden…</p>
      </div>
    );
  }
  if (!session?.user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Niet ingelogd.</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Deelnemers verwijderen</title>
      </Head>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <dialog
          ref={dialogRef}
          className="max-w-lg rounded-lg border border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50"
          onClose={() => {
            setPending(null);
            setUnderstood(false);
            setConfirmLoginInput('');
          }}
        >
          {pending && (
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-destructive">Deelnemer permanent verwijderen</h2>
              <p className="text-sm text-muted-foreground">
                Deze actie kan niet ongedaan worden gemaakt. Alle koppelingen met waarneemgroepen en het
                inlogaccount worden verwijderd uit het systeem.
              </p>
              <ul className="text-sm border rounded-md border-border p-3 space-y-1 bg-muted/30">
                <li>
                  <span className="text-muted-foreground">Naam: </span>
                  <strong>{formatNaam(pending)}</strong>
                </li>
                <li>
                  <span className="text-muted-foreground">Id: </span>
                  <strong>{pending.id}</strong>
                </li>
                <li>
                  <span className="text-muted-foreground">Login: </span>
                  <strong>{pending.login ?? '—'}</strong>
                </li>
                <li>
                  <span className="text-muted-foreground">Waarneemgroepen: </span>
                  <strong>{pending.waarneemgroepen.length}</strong>
                </li>
              </ul>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="begrepen"
                  checked={understood}
                  onCheckedChange={setUnderstood}
                />
                <Label htmlFor="begrepen" className="text-sm font-normal leading-snug cursor-pointer">
                  Ik begrijp dat deze actie permanent is en niet terug te draaien is.
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-login">
                  Typ het login (e-mailadres) hieronder exact overeenkomend om te bevestigen:
                </Label>
                <Input
                  id="confirm-login"
                  type="text"
                  autoComplete="off"
                  value={confirmLoginInput}
                  onChange={(e) => setConfirmLoginInput(e.target.value)}
                  placeholder={pending.login ?? ''}
                  className={loginMatches && understood ? 'border-green-600/50' : undefined}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={deleting}>
                  Annuleren
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!canSubmitDelete}
                  onClick={() => void handleDeleteConfirmed()}
                >
                  {deleting ? 'Bezig…' : 'Verwijder definitief'}
                </Button>
              </div>
            </div>
          )}
        </dialog>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>
                  <h1 className="text-2xl font-semibold tracking-tight">Deelnemers verwijderen</h1>
                </CardTitle>
                {isAdmin && allWaarneemgroepen.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="wg-filter" className="text-sm text-muted-foreground whitespace-nowrap">
                      Waarneemgroep:
                    </label>
                    <select
                      id="wg-filter"
                      value={filterWgId}
                      onChange={handleFilterChange}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Alle groepen</option>
                      {allWaarneemgroepen.map((wg) => (
                        <option key={wg.id} value={wg.id}>
                          {wg.naam ?? `Groep ${wg.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <input
                type="search"
                placeholder="Zoek op naam, login of waarneemgroep…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </CardHeader>
          <CardContent>
            {!isAdmin && !loading && (
              <p className="text-sm text-muted-foreground">U heeft geen toegang tot deze pagina.</p>
            )}
            {isAdmin && loading && <p className="text-sm text-muted-foreground">Laden…</p>}
            {isAdmin && error && <p className="text-sm text-destructive">{error}</p>}
            {isAdmin && !loading && !error && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {search ? 'Geen resultaten gevonden.' : 'Geen deelnemers gevonden.'}
              </p>
            )}
            {isAdmin && !loading && !error && filtered.length > 0 && (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  {filtered.length} van {deelnemers.length} deelnemers
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Naam</th>
                        <th className="pb-2 pr-4 font-medium">Login</th>
                        {showWaarneemgroepColumn && <th className="pb-2 pr-4 font-medium">Waarneemgroepen</th>}
                        <th className="pb-2 font-medium w-32">Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((d) => {
                        const isSelf = Number.isFinite(currentDeelnemerId) && d.id === currentDeelnemerId;
                        const isOtherAdmin = d.idgroep === GROEP_ADMINISTRATOR;
                        const hasLogin = !!(d.login?.trim());
                        const canShowDelete = !isSelf && !isOtherAdmin && hasLogin;

                        return (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-2.5 pr-4 font-medium">{formatNaam(d)}</td>
                            <td className="py-2.5 pr-4 text-muted-foreground">{d.login ?? '—'}</td>
                            {showWaarneemgroepColumn && (
                              <td className="py-2.5 pr-4">
                                {d.waarneemgroepen.length > 0 ? (
                                  <span className="text-muted-foreground">
                                    {d.waarneemgroepen.map((wg, i, arr) => (
                                      <span key={wg.id}>
                                        {wg.naam}
                                        {i < arr.length - 1 && <br />}
                                      </span>
                                    ))}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            )}
                            <td className="py-2.5">
                              {canShowDelete ? (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => openConfirm(d)}
                                >
                                  Verwijder
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {isSelf ? 'Eigen account' : isOtherAdmin ? 'Beheerder' : 'Geen login'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
