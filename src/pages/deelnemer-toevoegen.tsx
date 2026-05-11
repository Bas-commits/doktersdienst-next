'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import { Loader2, UserPlus, X } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DeelnemerNieuwOptiesResponse } from './api/deelnemers/nieuw/opties';
import type { DeelnemerWithGroepen } from './api/deelnemers/index';
import { ROL_LABELS } from '@/lib/rol-labels';

/** Zelfde als rooster-maken-secretaris: rol `groepen.id` voor secretaris in een waarneemgroep. */
const GROEP_SECRETARIS = 2;
const GROEP_ADMINISTRATOR = 5;

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50';

function toOpties(data: unknown): DeelnemerNieuwOptiesResponse | null {
  if (!data || typeof data !== 'object') return null;
  return data as DeelnemerNieuwOptiesResponse;
}

function formatNaam(d: DeelnemerWithGroepen): string {
  return [d.voornaam, d.voorletterstussenvoegsel, d.achternaam].filter(Boolean).join(' ');
}

function getDisplayInitials(d: DeelnemerWithGroepen): string {
  const fallback = [d.voornaam, d.achternaam]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim().charAt(0).toUpperCase())
    .join('');
  return fallback.slice(0, 3) || '—';
}

export default function DeelnemerToevoegenPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const {
    waarneemgroepen,
    activeWaarneemgroepId,
    activeWaarneemgroep,
    loading: wgCtxLoading,
    error: wgCtxError,
  } = useWaarneemgroep();

  const [optieState, setOptieState] = useState<
    | { status: 'idle' | 'loading' }
    | { status: 'ok'; data: DeelnemerNieuwOptiesResponse }
    | { status: 'err'; msg: string }
  >({ status: 'idle' });

  const [email, setEmail] = useState('');
  const [voornaam, setVoornaam] = useState('');
  const [tussen, setTussen] = useState('');
  const [achternaam, setAchternaam] = useState('');
  const [initialen, setInitialen] = useState('');
  const [idgroep, setIdgroep] = useState('');
  const [bestaatInAndereWaarneemgroep, setBestaatInAndereWaarneemgroep] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [leden, setLeden] = useState<DeelnemerWithGroepen[]>([]);
  const [ledenLoading, setLedenLoading] = useState(false);
  const [ledenError, setLedenError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
  const [resendingVerificationId, setResendingVerificationId] = useState<number | null>(null);

  const colorInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  const isAdmin = useMemo(
    () => (waarneemgroepen ?? []).some((wg) => wg.idgroep === GROEP_ADMINISTRATOR),
    [waarneemgroepen]
  );

  const myDeelnemerId =
    session?.user?.id != null && session.user.id !== '' ? Number(session.user.id) : NaN;

  const loadOpties = useCallback(async (wgId: string | null) => {
    setOptieState({ status: 'loading' });
    try {
      const qs =
        wgId && wgId.trim() !== ''
          ? `?idwaarneemgroep=${encodeURIComponent(wgId)}`
          : '';
      const r = await fetch(`/api/deelnemers/nieuw/opties${qs}`, { credentials: 'include' });
      if (r.status === 401) {
        setOptieState({ status: 'err', msg: 'U bent niet ingelogd.' });
        return;
      }
      const raw = await r.json();
      if (!r.ok && 'error' in raw) {
        setOptieState({ status: 'err', msg: String((raw as { error: string }).error) });
        return;
      }
      const parsed = toOpties(raw);
      if (!parsed || 'error' in parsed) {
        setOptieState({ status: 'err', msg: 'Kon opties niet laden.' });
        return;
      }
      setOptieState({ status: 'ok', data: parsed });
    } catch {
      setOptieState({ status: 'err', msg: 'Netwerkfout bij laden van rechten.' });
    }
  }, []);

  const loadLeden = useCallback(async (wgId: number) => {
    setLedenLoading(true);
    setLedenError(null);
    try {
      const res = await fetch(`/api/deelnemers?idwaarneemgroep=${wgId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.error) {
        setLedenError(data.error);
        setLeden([]);
        return;
      }
      setLeden(data.deelnemers ?? []);
    } catch {
      setLedenError('Kon deelnemers niet laden');
      setLeden([]);
    } finally {
      setLedenLoading(false);
    }
  }, []);

  /** Actieve groep bestaat maar gebruiker is daar geen secretaris (zelfde logica als rooster-maken-secretaris). */
  const isActiveGroupForbidden = useMemo(() => {
    if (isAdmin) return false;
    if (!activeWaarneemgroepId) return false;
    const n = Number(activeWaarneemgroepId);
    if (Number.isNaN(n)) return false;
    const activeWg = (waarneemgroepen ?? []).find((wg) => wg.ID === n);
    if (!activeWg && wgCtxLoading) return false;
    return activeWg ? activeWg.idgroep !== GROEP_SECRETARIS : false;
  }, [activeWaarneemgroepId, isAdmin, waarneemgroepen, wgCtxLoading]);

  useEffect(() => {
    if (!session?.user) return;
    void loadOpties(activeWaarneemgroepId);
  }, [activeWaarneemgroepId, session?.user, loadOpties]);

  useEffect(() => {
    const allowed =
      optieState.status === 'ok' &&
      'allowed' in optieState.data &&
      optieState.data.allowed === true;
    if (!allowed) return;
    if (isActiveGroupForbidden) {
      setLedenLoading(false);
      setLeden([]);
      setLedenError(null);
      return;
    }
    const n = activeWaarneemgroepId != null ? Number(activeWaarneemgroepId) : NaN;
    if (!Number.isFinite(n) || n <= 0) {
      setLedenLoading(false);
      setLeden([]);
      return;
    }
    void loadLeden(n);
  }, [optieState, activeWaarneemgroepId, loadLeden, isActiveGroupForbidden]);

  const optiesLoading =
    optieState.status === 'idle' || optieState.status === 'loading';
  const opties =
    optieState.status === 'ok' && 'allowed' in optieState.data ? optieState.data : null;
  const mayCreate = !!opties?.allowed;

  const groepChoices = opties?.groepen ?? [];
  const forbiddenReason =
    optieState.status === 'ok' && opties && 'allowed' in opties && !opties.allowed
      ? opties.forbiddenReason
      : null;

  const selectedWgLabel = activeWaarneemgroep?.naam;

  const validateClient = (): string | null => {
    const em = email.trim().toLowerCase();
    if (!em) return 'Vul een e-mailadres in.';
    if (!em.includes('@')) return 'Vul een geldig e-mailadres in.';
    if (
      !bestaatInAndereWaarneemgroep &&
      (!voornaam.trim() || !achternaam.trim() || !initialen.trim())
    ) {
      return 'Voornaam, achternaam en initialen zijn verplicht.';
    }
    if (!idgroep) return 'Selecteer een rol.';
    const wg = activeWaarneemgroepId != null ? Number(activeWaarneemgroepId) : NaN;
    if (!Number.isFinite(wg) || wg <= 0) {
      return 'Kies eerst een waarneemgroep in de kopbalk.';
    }
    if (isActiveGroupForbidden) {
      return 'U bent geen secretaris voor de gekozen waarneemgroep.';
    }
    return null;
  };

  async function handleColorChange(deelnemerId: number, color: string) {
    setLeden((prev) => prev.map((d) => (d.id === deelnemerId ? { ...d, color } : d)));
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

  async function handleRemoveFromWg(deelnemerId: number) {
    const wg = activeWaarneemgroepId != null ? Number(activeWaarneemgroepId) : NaN;
    if (!Number.isFinite(wg)) return;
    setRemovingId(deelnemerId);
    try {
      const res = await fetch('/api/deelnemers/registratie', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actie: 'afmelden',
          IDdeelnemer: deelnemerId,
          IDwaarneemgroep: wg,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(typeof data.error === 'string' ? data.error : 'Afmelden mislukt');
        return;
      }
      toast.success('Deelnemer uit deze groep afgemeld.');
      void loadLeden(wg);
    } catch {
      toast.error('Afmelden mislukt');
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  }

  function requestRemoveFromWg(deelnemerId: number) {
    setConfirmRemoveId(deelnemerId);
  }

  async function handleResendVerification(d: DeelnemerWithGroepen) {
    const wg = activeWaarneemgroepId != null ? Number(activeWaarneemgroepId) : NaN;
    if (!Number.isFinite(wg)) return;
    if (d.emailVerified === true) {
      toast.info('Dit e-mailadres is al geverifieerd.');
      return;
    }

    setResendingVerificationId(d.id);
    try {
      const res = await fetch('/api/deelnemers/verificatie-opnieuw', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iddeelnemer: d.id,
          idwaarneemgroep: wg,
          inviteInitiatedOrigin:
            typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        toast.error(typeof data.error === 'string' ? data.error : 'Verificatiemail versturen mislukt');
        return;
      }
      toast.success('Verificatiemail opnieuw verstuurd.');
      if (data.emailVerified === true) {
        setLeden((prev) => prev.map((row) => (row.id === d.id ? { ...row, emailVerified: true } : row)));
      }
    } catch {
      toast.error('Verificatiemail versturen mislukt');
    } finally {
      setResendingVerificationId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = validateClient();
    if (msg) {
      toast.error(msg);
      return;
    }

    const idWG = activeWaarneemgroepId != null ? Number(activeWaarneemgroepId) : NaN;
    const idRol = Number(idgroep);
    if (!Number.isFinite(idWG) || !waarneemgroepen.some((w) => w.ID === idWG)) {
      toast.error('Kies een geldige waarneemgroep in de kopbalk.');
      return;
    }
    if (isActiveGroupForbidden) {
      toast.error('U bent geen secretaris voor deze waarneemgroep.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/deelnemers/nieuw', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          voornaam: voornaam.trim(),
          voorletterstussenvoegsel: tussen.trim(),
          achternaam: achternaam.trim(),
          initialen: initialen.trim(),
          idgroep: idRol,
          idwaarneemgroep: idWG,
          bestaatInAndereWaarneemgroep,
          inviteInitiatedOrigin:
            typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof body?.error === 'string' ? body.error : `Fout (${res.status})`);
        return;
      }
      const outcome =
        typeof (body as { outcome?: string }).outcome === 'string'
          ? (body as { outcome: string }).outcome
          : 'created';
      if (outcome === 'already-linked') {
        toast.info('gebruiker al toegewezen aan deze waarneemgroep');
        return;
      }
      const okMsg =
        typeof (body as { message?: string }).message === 'string'
          ? (body as { message: string }).message
          : 'Deelnemer toegevoegd.';
      toast.success(okMsg);
      setEmail('');
      setVoornaam('');
      setTussen('');
      setAchternaam('');
      setInitialen('');
      setIdgroep('');
      setBestaatInAndereWaarneemgroep(false);
      setIsAddModalOpen(false);
      void loadOpties(activeWaarneemgroepId);
      void loadLeden(idWG);
    } catch {
      toast.error('Opslaan mislukt. Probeer het opnieuw.');
    } finally {
      setSubmitting(false);
    }
  }

  function openDeelnemerGegevens(deelnemerId: number) {
    void router.push(`/mijn-gegevens?deelnemerId=${deelnemerId}`);
  }

  if (sessionPending) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Laden…</p>
      </div>
    );
  }
  if (!session?.user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Niet ingelogd.</p>
      </div>
    );
  }

  const wgNumeric =
    activeWaarneemgroepId != null && activeWaarneemgroepId !== ''
      ? Number(activeWaarneemgroepId)
      : NaN;

  return (
    <>
      <Head>
        <title>Deelnemer toevoegen</title>
      </Head>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl font-semibold tracking-tight">Deelnemer toevoegen</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {optieState.status === 'err' && (
              <p className="text-sm text-destructive">{optieState.msg}</p>
            )}

            {optiesLoading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Rechten laden…
              </p>
            )}

            {forbiddenReason && !optiesLoading && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                <p className="font-medium text-destructive">Geen toegang</p>
                <p className="mt-1 text-muted-foreground">{forbiddenReason}</p>
              </div>
            )}

            {mayCreate && isActiveGroupForbidden && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800" role="alert">
                U bent geen secretaris voor deze waarneemgroep, kies een andere waarneemgroep.
              </div>
            )}

            {mayCreate && (
              <>
                {wgCtxError && (
                  <p className="text-sm text-amber-600">Waarschuwing waarneemgroepen: {wgCtxError}</p>
                )}
                {wgCtxLoading && waarneemgroepen.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waarneemgroepen laden…
                  </p>
                ) : waarneemgroepen.length === 0 ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    U heeft nog geen waarneemgroepen. Kies een groep in de kopbalk of vraag de beheerder om
                    toegang.
                  </p>
                ) : null}

                {!isActiveGroupForbidden && (
                  <p className="text-sm text-muted-foreground">
                    Voeg een deelnemer toe via de knop rechtsboven in de deelnemerslijst.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {mayCreate &&
          !isActiveGroupForbidden &&
          Number.isFinite(wgNumeric) &&
          wgNumeric > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold tracking-tight">
                      Deelnemers in deze waarneemgroep
                      {selectedWgLabel ? ` — ${selectedWgLabel}` : ''}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Nieuwe deelnemer toevoegen"
                        aria-label="Nieuwe deelnemer toevoegen"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
                        onClick={() => setIsAddModalOpen(true)}
                      >
                        <UserPlus className="h-5 w-5 text-white" />
                      </button>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ledenLoading && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Laden…
                  </p>
                )}
                {ledenError && <p className="text-sm text-destructive">{ledenError}</p>}
                {!ledenLoading && !ledenError && leden.length === 0 && (
                  <p className="text-sm text-muted-foreground">Geen deelnemers gevonden voor deze groep.</p>
                )}
                {!ledenLoading && !ledenError && leden.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Naam</th>
                          <th className="pb-2 pr-4 font-medium">Email</th>
                          <th className="pb-2 pr-4 font-medium">Verificatie</th>
                          <th className="w-[6rem] pb-2 pr-4 font-medium">Kleur</th>
                          <th className="pb-2 pr-4 font-medium">Rol in groep</th>
                          <th className="pb-2 font-medium w-44" />
                        </tr>
                      </thead>
                      <tbody>
                        {leden.map((d) => {
                          const rolInWg = d.waarneemgroepen.find((wg) => wg.id === wgNumeric)?.idgroep;
                          return (
                            <tr
                              key={d.id}
                              className="cursor-pointer border-b last:border-0 even:bg-muted/80 hover:bg-muted/50"
                              onClick={() => openDeelnemerGegevens(d.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  openDeelnemerGegevens(d.id);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              title="Open gegevens van deze deelnemer"
                            >
                              <td className="py-2.5 pr-4 font-medium">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-flex h-8 min-w-10 items-center justify-center rounded-md px-2 text-xs font-semibold text-white"
                                    style={{ backgroundColor: d.color || '#cccccc' }}
                                  >
                                    {getDisplayInitials(d)}
                                  </span>
                                  <span>{formatNaam(d)}</span>
                                </div>
                              </td>
                              <td className="py-2.5 pr-4 text-muted-foreground">{d.login ?? '—'}</td>
                              <td className="py-2.5 pr-4">
                                <div className="flex flex-col gap-1">
                                  <span
                                    className={`w-fit rounded px-2 py-0.5 text-xs font-medium ${
                                      d.emailVerified === true
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-amber-100 text-amber-900'
                                    }`}
                                  >
                                    {d.emailVerified === true ? 'Geverifieerd' : 'Niet geverifieerd'}
                                  </span>
                                  {d.emailVerified !== true && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-fit text-xs"
                                      disabled={resendingVerificationId === d.id || !d.login}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleResendVerification(d);
                                      }}
                                    >
                                      {resendingVerificationId === d.id ? 'Bezig…' : 'Opnieuw sturen'}
                                    </Button>
                                  )}
                                </div>
                              </td>
                              <td className="w-[6rem] py-2.5 pr-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    title="Wijzig kleur"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      colorInputRefs.current.get(d.id)?.click();
                                    }}
                                    className="h-6 w-[3.75rem] rounded border border-input shadow-sm transition-transform hover:scale-105"
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
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleColorChange(d.id, e.target.value)}
                                  />
                                </div>
                              </td>
                              <td className="py-2.5 pr-4 text-muted-foreground">
                                {rolInWg != null ? ROL_LABELS[rolInWg] ?? `Rol ${rolInWg}` : '—'}
                              </td>
                              <td className="py-2.5">
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 text-xs"
                                  disabled={
                                    removingId === d.id ||
                                    (Number.isFinite(myDeelnemerId) && d.id === myDeelnemerId)
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestRemoveFromWg(d.id);
                                  }}
                                >
                                  {removingId === d.id
                                    ? 'Bezig…'
                                    : Number.isFinite(myDeelnemerId) && d.id === myDeelnemerId
                                      ? '—'
                                      : 'Afmelden'}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
      </div>
      {confirmRemoveId != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Bevestig afmelden deelnemer"
          onClick={() => {
            if (removingId == null) setConfirmRemoveId(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold tracking-tight">Deelnemer afmelden</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Weet u zeker dat u deze deelnemer uit deze waarneemgroep wilt afmelden?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={removingId != null}
                onClick={() => setConfirmRemoveId(null)}
              >
                Annuleren
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={removingId != null}
                onClick={() => void handleRemoveFromWg(confirmRemoveId)}
              >
                {removingId != null ? 'Bezig…' : 'Ja, afmelden'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {isAddModalOpen && mayCreate && !isActiveGroupForbidden && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Nieuwe deelnemer toevoegen"
          onClick={() => {
            if (!submitting) setIsAddModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-2xl rounded-xl border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Nieuwe deelnemer toevoegen</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsAddModalOpen(false)}
                disabled={submitting}
                aria-label="Sluit toevoegen deelnemer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form id="deelnemer-formulier" onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="email">
                  E‑mailadres <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  De nieuwe gebruiker ontvangt één e‑mail met een link om dit adres te bevestigen; daarna wordt direct
                  gevraagd een sterk wachtwoord te kiezen. U hoeft hier geen wachtwoord meer in te vullen.
                </p>
                <p className="text-xs text-muted-foreground">
                  De waarneemgroep waarin de deelnemer wordt toegevoegd volgt uit de keuze in de kopbalk
                  {selectedWgLabel ? <> ({selectedWgLabel})</> : null}.
                </p>
                <label className="mt-1 inline-flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={bestaatInAndereWaarneemgroep}
                    onChange={(e) => setBestaatInAndereWaarneemgroep(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  deelnemer bestaat al binnen een andere waarneemgroep
                </label>
                {bestaatInAndereWaarneemgroep && (
                  <p className="text-xs text-muted-foreground">
                    Met deze optie wordt de deelnemer op basis van e-mailadres opgezocht en alleen aan deze
                    waarneemgroep gekoppeld.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="rol">
                    Rol deelnemer <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="rol"
                    className={selectClass}
                    value={idgroep}
                    onChange={(e) => setIdgroep(e.target.value)}
                    disabled={groepChoices.length === 0}
                    required
                  >
                    <option value="">— Kies —</option>
                    {groepChoices.map((g) => (
                      <option key={g.id} value={String(g.id)}>
                        {g.naam ?? `Groep ${g.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!bestaatInAndereWaarneemgroep && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="vn">
                        Voornaam <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="vn"
                        value={voornaam}
                        onChange={(e) => setVoornaam(e.target.value)}
                        required={!bestaatInAndereWaarneemgroep}
                        maxLength={50}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="an">
                        Achternaam <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="an"
                        value={achternaam}
                        onChange={(e) => setAchternaam(e.target.value)}
                        required={!bestaatInAndereWaarneemgroep}
                        maxLength={50}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="inl">
                        Initialen <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="inl"
                        value={initialen}
                        onChange={(e) => setInitialen(e.target.value)}
                        required={!bestaatInAndereWaarneemgroep}
                        maxLength={50}
                      />
                    </div>
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={
                  submitting ||
                  waarneemgroepen.length === 0 ||
                  groepChoices.length === 0 ||
                  !activeWaarneemgroepId
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Bezig…
                  </>
                ) : (
                  'Opslaan'
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
