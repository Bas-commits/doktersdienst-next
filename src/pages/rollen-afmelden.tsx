'use client';

import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DeelnemerGroepRow } from './api/deelnemers/groepen';

const GROEP_DEELNEMER = 1;
const GROEP_SECRETARIS = 2;
const GROEP_RECEPTIONIST = 3;
const GROEP_KIJKER = 4;

const ROL_LABELS: Record<number, string> = {
  [GROEP_DEELNEMER]: 'Deelnemer',
  [GROEP_SECRETARIS]: 'Secretaris',
  [GROEP_RECEPTIONIST]: 'Receptionist',
  [GROEP_KIJKER]: 'Kijker',
};

const BRAND = '#c91b23';

function formatNaam(row: Pick<DeelnemerGroepRow, 'voornaam' | 'voorletterstussenvoegsel' | 'achternaam'>): string {
  return [row.voornaam, row.voorletterstussenvoegsel, row.achternaam].filter(Boolean).join(' ');
}

type RowState = DeelnemerGroepRow & { saving: boolean };

function rowKey(deelnemerId: number, wgId: number) {
  return `${deelnemerId}-${wgId}`;
}

export default function RollenAfmeldenPage() {
  const { data: session, isPending } = authClient.useSession();

  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterRol, setFilterRol] = useState<number | ''>('');
  const [onlyAangemeld, setOnlyAangemeld] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/deelnemers/groepen', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setRows((data.rows as DeelnemerGroepRow[]).map((r) => ({ ...r, saving: false })));
      })
      .catch(() => setError('Kon gegevens niet laden'))
      .finally(() => setLoading(false));
  }, [session?.user]);

  function setRowSaving(deelnemerId: number, wgId: number, saving: boolean) {
    setRows((prev) =>
      prev.map((r) => r.deelnemerId === deelnemerId && r.wgId === wgId ? { ...r, saving } : r)
    );
  }

  async function handleRegistratie(actie: 'aanmelden' | 'afmelden', deelnemerId: number, wgId: number) {
    setRowSaving(deelnemerId, wgId, true);
    const newAangemeld = actie === 'aanmelden';

    setRows((prev) =>
      prev.map((r) => r.deelnemerId === deelnemerId && r.wgId === wgId ? { ...r, aangemeld: newAangemeld } : r)
    );

    try {
      const res = await fetch('/api/deelnemers/registratie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ actie, IDdeelnemer: deelnemerId, IDwaarneemgroep: wgId }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(`Mislukt: ${data.error}`);
        setRows((prev) =>
          prev.map((r) => r.deelnemerId === deelnemerId && r.wgId === wgId ? { ...r, aangemeld: !newAangemeld } : r)
        );
      } else {
        toast.success(actie === 'aanmelden' ? 'Aangemeld' : 'Afgemeld');
      }
    } catch {
      toast.error('Actie mislukt');
      setRows((prev) =>
        prev.map((r) => r.deelnemerId === deelnemerId && r.wgId === wgId ? { ...r, aangemeld: !newAangemeld } : r)
      );
    } finally {
      setRowSaving(deelnemerId, wgId, false);
    }
  }

  async function handleRolChange(deelnemerId: number, wgId: number, idgroep: number) {
    // Optimistic update immediately
    setRows((prev) =>
      prev.map((r) => r.deelnemerId === deelnemerId && r.wgId === wgId ? { ...r, idgroepInWg: idgroep, saving: true } : r)
    );

    try {
      const res = await fetch('/api/deelnemers/registratie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ actie: 'groep', IDdeelnemer: deelnemerId, IDwaarneemgroep: wgId, IDgroep: idgroep }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(`Rol wijzigen mislukt: ${data.error}`);
      }
    } catch {
      toast.error('Rol wijzigen mislukt');
    } finally {
      setRowSaving(deelnemerId, wgId, false);
    }
  }

  // Build grouped structure first (all data), then apply filters
  const allGrouped = useMemo(() => {
    return rows.reduce<{ id: number; naam: string; rows: RowState[] }[]>((acc, row) => {
      const existing = acc.find((g) => g.id === row.deelnemerId);
      if (existing) existing.rows.push(row);
      else acc.push({ id: row.deelnemerId, naam: formatNaam(row), rows: [row] });
      return acc;
    }, []);
  }, [rows]);

  const filteredGrouped = useMemo(() => {
    const q = search.trim().toLowerCase();

    return allGrouped
      .map((group) => {
        // Filter rows within each participant group
        const filteredRows = group.rows.filter((row) => {
          if (onlyAangemeld && !row.aangemeld) return false;
          if (filterRol !== '' && row.idgroepInWg !== filterRol) return false;
          if (q) {
            const wgMatch = (row.wgNaam ?? '').toLowerCase().includes(q);
            if (!wgMatch) return false;
          }
          return true;
        });

        // Check if participant name matches search
        const nameMatch = !q || group.naam.toLowerCase().includes(q);

        if (nameMatch) {
          // Name matches: show all group rows (still apply rol/aangemeld filters)
          const nameFilteredRows = group.rows.filter((row) => {
            if (onlyAangemeld && !row.aangemeld) return false;
            if (filterRol !== '' && row.idgroepInWg !== filterRol) return false;
            return true;
          });
          if (nameFilteredRows.length === 0) return null;
          return { ...group, rows: nameFilteredRows };
        }

        // Name doesn't match: show only rows where wgNaam matches search
        if (filteredRows.length === 0) return null;
        return { ...group, rows: filteredRows };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [allGrouped, search, filterRol, onlyAangemeld]);

  const totalVisible = filteredGrouped.reduce((sum, g) => sum + g.rows.length, 0);

  if (isPending) return <div className="mx-auto max-w-5xl px-4 py-8"><p className="text-sm text-muted-foreground">Laden…</p></div>;
  if (!session?.user) return <div className="mx-auto max-w-5xl px-4 py-8"><p className="text-sm text-muted-foreground">Niet ingelogd.</p></div>;

  return (
    <>
      <Head><title>Rollen & Afmelden</title></Head>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <CardTitle>
                <h1 className="text-2xl font-semibold tracking-tight">Rollen & Afmelden</h1>
              </CardTitle>

              {/* Search + filters */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                <input
                  type="search"
                  placeholder="Zoek op naam of waarneemgroep…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />

                <select
                  value={filterRol}
                  onChange={(e) => setFilterRol(e.target.value === '' ? '' : Number(e.target.value))}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Alle rollen</option>
                  {Object.entries(ROL_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>

                <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
                  <input
                    type="checkbox"
                    checked={onlyAangemeld}
                    onChange={(e) => setOnlyAangemeld(e.target.checked)}
                    className="rounded border-input accent-[#c91b23]"
                  />
                  Alleen aangemeld
                </label>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading && <p className="text-sm text-muted-foreground">Laden…</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!loading && !error && filteredGrouped.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {search || filterRol !== '' || onlyAangemeld ? 'Geen resultaten gevonden.' : 'Geen deelnemers gevonden.'}
              </p>
            )}

            {!loading && !error && filteredGrouped.length > 0 && (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  {totalVisible} rijen · {filteredGrouped.length} deelnemers
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-6 font-medium w-44">Naam</th>
                        <th className="pb-2 pr-6 font-medium">Waarneemgroep</th>
                        <th className="pb-2 pr-4 font-medium w-44">Rol</th>
                        <th className="pb-2 font-medium w-28"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGrouped.map((group) =>
                        group.rows.map((row, rowIndex) => {
                          const key = rowKey(row.deelnemerId, row.wgId);
                          const currentRol = row.idgroepInWg ?? GROEP_DEELNEMER;

                          return (
                            <tr key={key} className="border-b last:border-0 hover:bg-muted/50">
                              {/* Name — only on first row per participant */}
                              <td className="py-2 pr-6 font-medium align-top">
                                {rowIndex === 0 ? (
                                  <span className="text-primary">{group.naam}</span>
                                ) : null}
                              </td>

                              {/* Waarneemgroep */}
                              <td className="py-2 pr-6 text-muted-foreground align-top">
                                {row.wgNaam ?? `Groep ${row.wgId}`}
                              </td>

                              {/* Role — instant change, no Wijzig button */}
                              <td className="py-2 pr-4 align-top">
                                {row.aangemeld ? (
                                  <select
                                    value={currentRol}
                                    disabled={row.saving}
                                    onChange={(e) => handleRolChange(row.deelnemerId, row.wgId, Number(e.target.value))}
                                    className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                                  >
                                    {Object.entries(ROL_LABELS).map(([id, label]) => (
                                      <option key={id} value={id}>{label}</option>
                                    ))}
                                  </select>
                                ) : null}
                              </td>

                              {/* Aanmelden / Afmelden */}
                              <td className="py-2 align-top">
                                {row.aangemeld ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={row.saving}
                                    onClick={() => handleRegistratie('afmelden', row.deelnemerId, row.wgId)}
                                  >
                                    Afmelden
                                  </Button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={row.saving}
                                    onClick={() => handleRegistratie('aanmelden', row.deelnemerId, row.wgId)}
                                    className="inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-[0.8rem] font-medium text-white transition-all disabled:pointer-events-none disabled:opacity-50"
                                    style={{ backgroundColor: BRAND }}
                                  >
                                    Aanmelden
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
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
