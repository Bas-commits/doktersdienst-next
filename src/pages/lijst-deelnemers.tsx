'use client';

import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DeelnemerWithGroepen } from './api/deelnemers/index';

function formatNaam(d: DeelnemerWithGroepen): string {
  return [d.voornaam, d.voorletterstussenvoegsel, d.achternaam]
    .filter(Boolean)
    .join(' ');
}

export default function LijstDeelnemersPage() {
  const { data: session, isPending } = authClient.useSession();

  const [deelnemers, setDeelnemers] = useState<DeelnemerWithGroepen[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allWaarneemgroepen, setAllWaarneemgroepen] = useState<{ id: number; naam: string | null }[]>([]);
  const [filterWgId, setFilterWgId] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colorInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  async function fetchDeelnemers(wgId?: number) {
    setLoading(true);
    setError(null);
    try {
      const url = wgId ? `/api/deelnemers?idwaarneemgroep=${wgId}` : '/api/deelnemers';
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
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

  async function handleColorChange(deelnemerId: number, color: string) {
    setDeelnemers((prev) => prev.map((d) => (d.id === deelnemerId ? { ...d, color } : d)));
    try {
      const res = await fetch('/api/deelnemers/color', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uid: deelnemerId, color }),
      });
      const data = await res.json();
      if (data.error) toast.error(`Kleur opslaan mislukt: ${data.error}`);
    } catch {
      toast.error('Kleur opslaan mislukt');
    }
  }

  // Client-side search: name, login, or waarneemgroep name
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

  if (isPending) return <div className="mx-auto max-w-4xl px-4 py-8"><p className="text-sm text-muted-foreground">Laden…</p></div>;
  if (!session?.user) return <div className="mx-auto max-w-4xl px-4 py-8"><p className="text-sm text-muted-foreground">Niet ingelogd.</p></div>;

  return (
    <>
      <Head><title>Lijst deelnemers</title></Head>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>
                  <h1 className="text-2xl font-semibold tracking-tight">Lijst deelnemers</h1>
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
                        <option key={wg.id} value={wg.id}>{wg.naam ?? `Groep ${wg.id}`}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Search bar */}
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
            {loading && <p className="text-sm text-muted-foreground">Laden…</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!loading && !error && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {search ? 'Geen resultaten gevonden.' : 'Geen deelnemers gevonden.'}
              </p>
            )}
            {!loading && !error && filtered.length > 0 && (
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
                        <th className="pb-2 pr-4 font-medium">Kleur</th>
                        {showWaarneemgroepColumn && <th className="pb-2 font-medium">Waarneemgroepen</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((d) => (
                        <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2.5 pr-4 font-medium">{formatNaam(d)}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{d.login ?? '—'}</td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                title="Wijzig kleur"
                                onClick={() => colorInputRefs.current.get(d.id)?.click()}
                                className="h-6 w-10 rounded border border-input shadow-sm hover:scale-105 transition-transform"
                                style={{ backgroundColor: d.color || '#cccccc' }}
                              />
                              <input
                                ref={(el) => {
                                  if (el) colorInputRefs.current.set(d.id, el);
                                  else colorInputRefs.current.delete(d.id);
                                }}
                                type="color"
                                className="sr-only"
                                value={d.color || '#cccccc'}
                                onChange={(e) => handleColorChange(d.id, e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => colorInputRefs.current.get(d.id)?.click()}
                                className="text-xs text-muted-foreground hover:text-foreground underline"
                              >
                                Wijzig
                              </button>
                            </div>
                          </td>
                          {showWaarneemgroepColumn && (
                            <td className="py-2.5">
                              {d.waarneemgroepen.length > 0 ? (
                                <span className="text-muted-foreground">
                                  {d.waarneemgroepen.map((wg) => wg.naam).join(', ')}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
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
