'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RegioItem } from './api/regios/index';

const NAAM_MIN = 4;
const NAAM_MAX = 40;

function RegioVerwijderenModal({
  regio,
  open,
  deleting,
  onClose,
  onConfirm,
}: {
  regio: RegioItem | null;
  open: boolean;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmNaam, setConfirmNaam] = useState('');

  useEffect(() => {
    if (open) setConfirmNaam('');
  }, [open, regio?.id]);

  if (!open || !regio) return null;

  const canConfirm = confirmNaam.trim() === regio.naam && !deleting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="regio-verwijderen-title"
      onClick={(e) => { if (e.target === e.currentTarget && !deleting) onClose(); }}
    >
      <Card className="w-full max-w-md shadow-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle id="regio-verwijderen-title">Regio verwijderen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            U staat op het punt om de regio <strong>{regio.naam}</strong> definitief te
            verwijderen. Deze actie kan niet ongedaan worden gemaakt.
          </p>
          <p className="text-sm font-medium">Typ de naam van de regio om te bevestigen:</p>
          <Input
            type="text"
            value={confirmNaam}
            onChange={(e) => setConfirmNaam(e.target.value)}
            placeholder={regio.naam}
            disabled={deleting}
            aria-label="Naam regio bevestigen"
          />
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>
            Annuleren
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={!canConfirm}>
            {deleting ? 'Bezig…' : 'Verwijderen'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function RegioToevoegenPage() {
  const { data: session, isPending } = authClient.useSession();

  const [regios, setRegios] = useState<RegioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [naam, setNaam] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [regioToDelete, setRegioToDelete] = useState<RegioItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchRegios = () => {
    setLoading(true);
    setLoadError(null);
    fetch('/api/regios', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setLoadError(data.error);
        } else {
          setRegios(data.regios ?? []);
        }
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Laden mislukt'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!session?.user) return;
    fetchRegios();
  }, [session?.user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = naam.trim();
    setSubmitError(null);

    if (trimmed.length < NAAM_MIN) {
      setSubmitError(`Naam moet minimaal ${NAAM_MIN} tekens zijn.`);
      return;
    }
    if (trimmed.length > NAAM_MAX) {
      setSubmitError(`Naam mag maximaal ${NAAM_MAX} tekens zijn.`);
      return;
    }
    if (regios.some((r) => r.naam.trim().toLowerCase() === trimmed.toLowerCase())) {
      setSubmitError('Er bestaat al een regio met deze naam.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/regios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ naam: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Toevoegen mislukt');
        return;
      }
      setNaam('');
      fetchRegios();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Toevoegen mislukt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!regioToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/regios/${regioToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? 'Verwijderen mislukt');
        return;
      }
      setRegioToDelete(null);
      fetchRegios();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Verwijderen mislukt');
    } finally {
      setDeleting(false);
    }
  };

  if (isPending || !session?.user) return null;

  return (
    <>
      <Head>
        <title>Regio toevoegen | Doktersdienst</title>
      </Head>

      <RegioVerwijderenModal
        regio={regioToDelete}
        open={regioToDelete !== null}
        deleting={deleting}
        onClose={() => { if (!deleting) { setRegioToDelete(null); setDeleteError(null); } }}
        onConfirm={handleDeleteConfirm}
      />

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Regio toevoegen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Voeg een nieuwe regio toe. Vul een naam in van {NAAM_MIN} tot {NAAM_MAX} tekens.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nieuwe regio</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="regio-naam">Naam *</Label>
                <Input
                  id="regio-naam"
                  type="text"
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  placeholder="Naam van de regio"
                  disabled={submitting}
                  maxLength={NAAM_MAX}
                />
              </div>
              {submitError && (
                <p className="text-sm text-destructive" role="alert">{submitError}</p>
              )}
              <div>
                <Button type="submit" disabled={submitting || !naam.trim()}>
                  {submitting ? 'Bezig…' : 'Toevoegen'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-semibold mb-3">Huidige regio's</h2>

          {deleteError && (
            <p className="text-sm text-destructive mb-3" role="alert">{deleteError}</p>
          )}

          {loading && (
            <p className="text-sm text-muted-foreground">Laden…</p>
          )}
          {!loading && loadError && (
            <p className="text-sm text-destructive" role="alert">{loadError}</p>
          )}
          {!loading && !loadError && (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pt-3 px-4 font-medium w-16">ID</th>
                    <th className="pb-2 pt-3 px-4 font-medium">Naam</th>
                    <th className="pb-2 pt-3 px-4 font-medium w-32" />
                  </tr>
                </thead>
                <tbody>
                  {regios.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-muted-foreground">
                        Geen regio's gevonden.
                      </td>
                    </tr>
                  ) : (
                    regios.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-2.5 text-muted-foreground">{r.id}</td>
                        <td className="px-4 py-2.5 font-medium">{r.naam}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => { setDeleteError(null); setRegioToDelete(r); }}
                            aria-label={`Regio ${r.naam} verwijderen`}
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
