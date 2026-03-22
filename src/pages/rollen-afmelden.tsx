'use client';

import Head from 'next/head';
import { useEffect, useState } from 'react';
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

function formatNaam(row: DeelnemerGroepRow): string {
  return [row.voornaam, row.voorletterstussenvoegsel, row.achternaam]
    .filter(Boolean)
    .join(' ');
}

type RowState = DeelnemerGroepRow & {
  /** Locally selected role before "Wijzig" is confirmed */
  pendingRol: number | null;
};

function rowKey(deelnemerId: number, wgId: number) {
  return `${deelnemerId}-${wgId}`;
}

export default function RollenAfmeldenPage() {
  const { data: session, isPending } = authClient.useSession();

  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/deelnemers/groepen', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setRows(
          (data.rows as DeelnemerGroepRow[]).map((r) => ({ ...r, pendingRol: null }))
        );
      })
      .catch(() => setError('Kon gegevens niet laden'))
      .finally(() => setLoading(false));
  }, [session?.user]);

  function markInFlight(key: string, active: boolean) {
    setInFlight((prev) => {
      const next = new Set(prev);
      active ? next.add(key) : next.delete(key);
      return next;
    });
  }

  async function handleRegistratie(
    actie: 'aanmelden' | 'afmelden',
    deelnemerId: number,
    wgId: number
  ) {
    const key = rowKey(deelnemerId, wgId);
    markInFlight(key, true);
    const newAangemeld = actie === 'aanmelden';

    // Optimistic update
    setRows((prev) =>
      prev.map((r) =>
        r.deelnemerId === deelnemerId && r.wgId === wgId
          ? { ...r, aangemeld: newAangemeld }
          : r
      )
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
        // Rollback
        setRows((prev) =>
          prev.map((r) =>
            r.deelnemerId === deelnemerId && r.wgId === wgId
              ? { ...r, aangemeld: !newAangemeld }
              : r
          )
        );
      } else {
        toast.success(actie === 'aanmelden' ? 'Aangemeld' : 'Afgemeld');
      }
    } catch {
      toast.error('Actie mislukt');
      setRows((prev) =>
        prev.map((r) =>
          r.deelnemerId === deelnemerId && r.wgId === wgId
            ? { ...r, aangemeld: !newAangemeld }
            : r
        )
      );
    } finally {
      markInFlight(key, false);
    }
  }

  async function handleRolWijzig(deelnemerId: number, wgId: number, idgroep: number) {
    const key = rowKey(deelnemerId, wgId);
    markInFlight(key, true);

    try {
      const res = await fetch('/api/deelnemers/registratie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          actie: 'groep',
          IDdeelnemer: deelnemerId,
          IDwaarneemgroep: wgId,
          IDgroep: idgroep,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(`Rol wijzigen mislukt: ${data.error}`);
      } else {
        toast.success('Rol gewijzigd');
        setRows((prev) =>
          prev.map((r) =>
            r.deelnemerId === deelnemerId && r.wgId === wgId
              ? { ...r, idgroepInWg: idgroep, pendingRol: null }
              : r
          )
        );
      }
    } catch {
      toast.error('Rol wijzigen mislukt');
    } finally {
      markInFlight(key, false);
    }
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Laden…</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Niet ingelogd.</p>
      </div>
    );
  }

  // Group rows by participant for display (name shown only on first row)
  const groupedByDeelnemer = rows.reduce<{ id: number; naam: string; rows: RowState[] }[]>(
    (acc, row) => {
      const existing = acc.find((g) => g.id === row.deelnemerId);
      if (existing) {
        existing.rows.push(row);
      } else {
        acc.push({ id: row.deelnemerId, naam: formatNaam(row), rows: [row] });
      }
      return acc;
    },
    []
  );

  return (
    <>
      <Head>
        <title>Rollen & Afmelden</title>
      </Head>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl font-semibold tracking-tight">Rollen & Afmelden</h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-sm text-muted-foreground">Laden…</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!loading && !error && groupedByDeelnemer.length === 0 && (
              <p className="text-sm text-muted-foreground">Geen deelnemers gevonden.</p>
            )}
            {!loading && !error && groupedByDeelnemer.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-6 font-medium w-40">Naam</th>
                      <th className="pb-2 pr-6 font-medium">Waarneemgroep</th>
                      <th className="pb-2 pr-4 font-medium w-64">Rol</th>
                      <th className="pb-2 font-medium w-28"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedByDeelnemer.map((group) =>
                      group.rows.map((row, rowIndex) => {
                        const key = rowKey(row.deelnemerId, row.wgId);
                        const busy = inFlight.has(key);
                        const currentRol = row.pendingRol ?? row.idgroepInWg ?? GROEP_DEELNEMER;
                        const rolChanged =
                          row.pendingRol !== null && row.pendingRol !== row.idgroepInWg;

                        return (
                          <tr
                            key={key}
                            className="border-b last:border-0 hover:bg-muted/50"
                          >
                            {/* Name cell — only shown on first row per participant */}
                            <td className="py-2 pr-6 font-medium align-top">
                              {rowIndex === 0 ? (
                                <span className="text-primary">{group.naam}</span>
                              ) : null}
                            </td>

                            {/* Waarneemgroep */}
                            <td className="py-2 pr-6 text-muted-foreground align-top">
                              {row.wgNaam ?? `Groep ${row.wgId}`}
                            </td>

                            {/* Role dropdown (only when aangemeld) */}
                            <td className="py-2 pr-4 align-top">
                              {row.aangemeld ? (
                                <div className="flex items-center gap-2">
                                  <select
                                    value={currentRol}
                                    disabled={busy}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setRows((prev) =>
                                        prev.map((r) =>
                                          r.deelnemerId === row.deelnemerId && r.wgId === row.wgId
                                            ? { ...r, pendingRol: val }
                                            : r
                                        )
                                      );
                                    }}
                                    className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                                  >
                                    {Object.entries(ROL_LABELS).map(([id, label]) => (
                                      <option key={id} value={id}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                  {rolChanged && (
                                    <Button
                                      size="sm"
                                      disabled={busy}
                                      onClick={() =>
                                        handleRolWijzig(row.deelnemerId, row.wgId, row.pendingRol!)
                                      }
                                    >
                                      Wijzig
                                    </Button>
                                  )}
                                </div>
                              ) : null}
                            </td>

                            {/* Action button */}
                            <td className="py-2 align-top">
                              {row.aangemeld ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() =>
                                    handleRegistratie('afmelden', row.deelnemerId, row.wgId)
                                  }
                                >
                                  Afmelden
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    handleRegistratie('aanmelden', row.deelnemerId, row.wgId)
                                  }
                                >
                                  Aanmelden
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
