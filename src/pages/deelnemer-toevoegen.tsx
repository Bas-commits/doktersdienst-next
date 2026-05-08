'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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

export default function DeelnemerToevoegenPage() {
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
  const [mobiel, setMobiel] = useState('');
  const [idgroep, setIdgroep] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const [leden, setLeden] = useState<DeelnemerWithGroepen[]>([]);
  const [ledenLoading, setLedenLoading] = useState(false);
  const [ledenError, setLedenError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
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
    if (!em.includes('@')) return 'Vul een geldig e-mailadres in.';
    if (!voornaam.trim() || !achternaam.trim() || !initialen.trim()) {
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
    if (!window.confirm('Deze deelnemer uit deze waarneemgroep afmelden?')) return;
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
    }
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
          huisadrtelnr: mobiel.trim(),
          idgroep: idRol,
          idwaarneemgroep: idWG,
          inviteInitiatedOrigin:
            typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof body?.error === 'string' ? body.error : `Fout (${res.status})`);
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
      setMobiel('');
      setIdgroep('');
      void loadOpties(activeWaarneemgroepId);
      void loadLeden(idWG);
    } catch {
      toast.error('Opslaan mislukt. Probeer het opnieuw.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionPending) {
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

  const wgNumeric =
    activeWaarneemgroepId != null && activeWaarneemgroepId !== ''
      ? Number(activeWaarneemgroepId)
      : NaN;

  return (
    <>
      <Head>
        <title>Deelnemer toevoegen</title>
      </Head>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
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
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-2">
                    <Label htmlFor="email">E‑mailadres</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={50}
                      className="max-w-xl"
                    />
                    <p className="max-w-xl text-xs text-muted-foreground">
                      De nieuwe gebruiker ontvangt één e‑mail met een link om dit adres te bevestigen; daarna wordt
                      direct gevraagd een sterk wachtwoord te kiezen. U hoeft hier geen wachtwoord meer in te vullen.
                    </p>
                    <p className="max-w-xl text-xs text-muted-foreground">
                      De waarneemgroep waarin de deelnemer wordt toegevoegd volgt uit de keuze in de kopbalk
                      {selectedWgLabel ? <> ({selectedWgLabel})</> : null}.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2 sm:col-span-2 sm:max-w-md">
                      <Label htmlFor="rol">Rol deelnemer</Label>
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

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="vn">Voornaam</Label>
                      <Input
                        id="vn"
                        value={voornaam}
                        onChange={(e) => setVoornaam(e.target.value)}
                        required
                        maxLength={50}
                      />
                    </div>
                    {/* <div className="grid gap-2">
                      <Label htmlFor="tussen">Voorletters / tussenvoegsel</Label>
                      <Input
                        id="tussen"
                        value={tussen}
                        onChange={(e) => setTussen(e.target.value)}
                        maxLength={50}
                      />
                    </div> */}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="an">Achternaam</Label>
                      <Input
                        id="an"
                        value={achternaam}
                        onChange={(e) => setAchternaam(e.target.value)}
                        required
                        maxLength={50}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="inl">Initialen</Label>
                      <Input
                        id="inl"
                        value={initialen}
                        onChange={(e) => setInitialen(e.target.value)}
                        required
                        maxLength={50}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="mob">Mobiele telefoon</Label>
                    <Input
                      id="mob"
                      type="tel"
                      value={mobiel}
                      onChange={(e) => setMobiel(e.target.value)}
                      maxLength={50}
                    />
                    <p className="text-xs text-muted-foreground">
                      Wordt opgeslagen bij het legacy veld voor het mobiele nummer van deelnemers.
                    </p>
                  </div>

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
                  <h2 className="text-lg font-semibold tracking-tight">
                    Deelnemers in deze waarneemgroep
                    {selectedWgLabel ? ` — ${selectedWgLabel}` : ''}
                  </h2>
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
                          <th className="pb-2 pr-4 font-medium">Kleur</th>
                          <th className="pb-2 pr-4 font-medium">Rol in groep</th>
                          <th className="pb-2 font-medium w-44" />
                        </tr>
                      </thead>
                      <tbody>
                        {leden.map((d) => {
                          const rolInWg = d.waarneemgroepen.find((wg) => wg.id === wgNumeric)?.idgroep;
                          return (
                            <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="py-2.5 pr-4 font-medium">{formatNaam(d)}</td>
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
                                      onClick={() => void handleResendVerification(d)}
                                    >
                                      {resendingVerificationId === d.id ? 'Bezig…' : 'Opnieuw sturen'}
                                    </Button>
                                  )}
                                </div>
                              </td>
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
                                  onClick={() => void handleRemoveFromWg(d.id)}
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
    </>
  );
}
