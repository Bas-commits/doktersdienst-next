'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import { Loader2, Trash2, UserPlus, X } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DeelnemerNieuwOptiesResponse } from './api/deelnemers/nieuw/opties';
import type { DeelnemerWithGroepen } from './api/deelnemers/index';
import { deelnemerChipInitials } from '@/lib/deelnemer-display';
import { ROL_LABELS } from '@/lib/rol-labels';

/** Zelfde als rooster-maken-secretaris: rol `groepen.id` voor secretaris in een waarneemgroep. */
const GROEP_SECRETARIS = 2;
const GROEP_ADMINISTRATOR = 5;
const BRAND = '#c91b23';
const ALREADY_IN_WG_ERROR =
  'Deze deelnemer zit al in deze waarneemgroep en kan daarom niet worden toegevoegd.';

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50';
const rolInGroepChoices = [
  { id: 1, label: 'Deelnemer' },
  { id: 2, label: 'Secretaris' },
] as const;
const functieChoices = [
  { id: 1, label: 'Ajo' },
  { id: 2, label: 'Specialist' },
  { id: 3, label: 'Assisitent' },
  { id: 4, label: 'Toa' },
] as const;

const FTE_DECIMAL_PLACES = 2;

function formatFteDisplay(n: number): string {
  const rounded =
    Math.round(n * 10 ** FTE_DECIMAL_PLACES) / 10 ** FTE_DECIMAL_PLACES;
  return new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: FTE_DECIMAL_PLACES,
    useGrouping: false,
  }).format(rounded);
}

function sanitizeFteInputString(raw: string): string {
  let s = raw.replace(/\./g, ',');
  s = s.replace(/[^\d,]/g, '');
  const firstComma = s.indexOf(',');
  if (firstComma === -1) return s;
  const intPart = s.slice(0, firstComma);
  let frac = s.slice(firstComma + 1).replace(/,/g, '');
  if (frac.length > FTE_DECIMAL_PLACES) frac = frac.slice(0, FTE_DECIMAL_PLACES);
  return intPart + ',' + frac;
}

function parseFteInputToNumber(s: string): number | null {
  const t = s.trim().replace(/\./g, ',');
  if (t === '' || t === ',') return null;
  const normalized = t.replace(',', '.');
  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

function commitFteNumber(n: number): number {
  const clamped = Math.min(2, Math.max(0, n));
  return Math.round(clamped * 10 ** FTE_DECIMAL_PLACES) / 10 ** FTE_DECIMAL_PLACES;
}

function toOpties(data: unknown): DeelnemerNieuwOptiesResponse | null {
  if (!data || typeof data !== 'object') return null;
  return data as DeelnemerNieuwOptiesResponse;
}

function formatNaam(d: DeelnemerWithGroepen): string {
  return [d.achternaam, d.voornaam, d.voorletterstussenvoegsel].filter(Boolean).join(', ');
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
  const [geslacht, setGeslacht] = useState<0 | 1 | null>(null);
  const [idgroep, setIdgroep] = useState('');
  const [idfunctie, setIdfunctie] = useState('');
  const [fte, setFte] = useState(1);
  const [fteDraft, setFteDraft] = useState<string | undefined>(undefined);
  const [bestaatInAndereWaarneemgroep, setBestaatInAndereWaarneemgroep] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [leden, setLeden] = useState<DeelnemerWithGroepen[]>([]);
  const [ledenLoading, setLedenLoading] = useState(false);
  const [ledenError, setLedenError] = useState<string | null>(null);
  const [toonAfgemelde, setToonAfgemelde] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
  const [registeringId, setRegisteringId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteIsLast, setConfirmDeleteIsLast] = useState(false);
  const [deletingMembershipId, setDeletingMembershipId] = useState<number | null>(null);
  const [resendingVerificationId, setResendingVerificationId] = useState<number | null>(null);
  const [updatingRolId, setUpdatingRolId] = useState<number | null>(null);
  const [updatingFunctieId, setUpdatingFunctieId] = useState<number | null>(null);
  const [updatingEchtedeelnemerId, setUpdatingEchtedeelnemerId] = useState<number | null>(null);

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
      const res = await fetch(`/api/deelnemers?idwaarneemgroep=${wgId}&beheer=1`, {
        credentials: 'include',
        cache: 'no-store',
      });
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

  const sortedLeden = useMemo(() => {
    const wgId =
      activeWaarneemgroepId != null && activeWaarneemgroepId !== ''
        ? Number(activeWaarneemgroepId)
        : NaN;
    if (!Number.isFinite(wgId) || wgId <= 0) return leden;

    const filtered = toonAfgemelde
      ? leden
      : leden.filter(
          (d) => d.waarneemgroepen.find((wg) => wg.id === wgId)?.aangemeld === true
        );

    return [...filtered].sort((a, b) => {
      const aAangemeld =
        a.waarneemgroepen.find((wg) => wg.id === wgId)?.aangemeld === true;
      const bAangemeld =
        b.waarneemgroepen.find((wg) => wg.id === wgId)?.aangemeld === true;
      if (aAangemeld === bAangemeld) return 0;
      return aAangemeld ? -1 : 1;
    });
  }, [leden, activeWaarneemgroepId, toonAfgemelde]);

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
    const fteRaw = fteDraft !== undefined ? fteDraft : formatFteDisplay(fte);
    const fteNum = parseFteInputToNumber(fteRaw);
    if (fteNum === null || fteNum < 0 || fteNum > 2) {
      return 'FTE moet tussen 0 en 2 liggen.';
    }
    if (idfunctie !== '') {
      const parsedFunctie = Number(idfunctie);
      if (!Number.isInteger(parsedFunctie) || parsedFunctie < 1 || parsedFunctie > 4) {
        return 'Selecteer een geldige functie.';
      }
    }
    if (Number.isFinite(wg) && wg > 0) {
      const alreadyInWg = leden.some((d) => {
        const memberEmail = (d.login ?? '').trim().toLowerCase();
        if (memberEmail !== em) return false;
        const membership = d.waarneemgroepen.find((w) => w.id === wg);
        return membership?.aangemeld === true;
      });
      if (alreadyInWg) return ALREADY_IN_WG_ERROR;
    }
    return null;
  };

  async function handleColorChange(deelnemerId: number, color: string) {
    let prevColor = '';
    setLeden((prev) =>
      prev.map((d) => {
        if (d.id !== deelnemerId) return d;
        prevColor = d.color ?? '';
        return { ...d, color };
      })
    );

    const wg = activeWaarneemgroepId != null ? Number(activeWaarneemgroepId) : NaN;
    const body: { uid: number; color: string; idwaarneemgroep?: number } = { uid: deelnemerId, color };
    if (Number.isFinite(wg)) body.idwaarneemgroep = wg;

    try {
      const res = await fetch('/api/deelnemers/color', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Kleur opslaan mislukt');
      }
      toast.success('Kleur opgeslagen.');
    } catch (error) {
      setLeden((prev) =>
        prev.map((d) => (d.id === deelnemerId ? { ...d, color: prevColor } : d))
      );
      toast.error(
        error instanceof Error ? `Kleur opslaan mislukt: ${error.message}` : 'Kleur opslaan mislukt'
      );
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

  async function handleRegisterInWg(deelnemerId: number) {
    const wg = activeWaarneemgroepId != null ? Number(activeWaarneemgroepId) : NaN;
    if (!Number.isFinite(wg)) return;
    setRegisteringId(deelnemerId);
    try {
      const res = await fetch('/api/deelnemers/registratie', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actie: 'aanmelden',
          IDdeelnemer: deelnemerId,
          IDwaarneemgroep: wg,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(typeof data.error === 'string' ? data.error : 'Aanmelden mislukt');
        return;
      }
      toast.success('Deelnemer opnieuw aangemeld in deze groep.');
      void loadLeden(wg);
    } catch {
      toast.error('Aanmelden mislukt');
    } finally {
      setRegisteringId(null);
    }
  }

  async function handleDeleteMembership(deelnemerId: number, isLastMembership: boolean) {
    const wg = activeWaarneemgroepId != null ? Number(activeWaarneemgroepId) : NaN;
    if (!Number.isFinite(wg)) return;
    setDeletingMembershipId(deelnemerId);
    try {
      const res = await fetch('/api/deelnemers/lidmaatschap', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iddeelnemer: deelnemerId,
          idwaarneemgroep: wg,
          bevestigVolledigeVerwijdering: isLastMembership ? true : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(typeof data.error === 'string' ? data.error : 'Verwijderen mislukt');
        return;
      }
      toast.success(
        data.volledigVerwijderd === true
          ? 'Deelnemer volledig uit het systeem verwijderd.'
          : 'Lidmaatschap verwijderd.'
      );
      void loadLeden(wg);
    } catch {
      toast.error('Verwijderen mislukt');
    } finally {
      setDeletingMembershipId(null);
      setConfirmDeleteId(null);
      setConfirmDeleteIsLast(false);
    }
  }

  async function handleEchtedeelnemerChange(deelnemerId: number, nextValue: boolean, wgId: number) {
    let prevValue = false;
    setLeden((prev) =>
      prev.map((d) => {
        if (d.id !== deelnemerId) return d;
        prevValue = d.echtedeelnemer === true;
        return { ...d, echtedeelnemer: nextValue };
      })
    );

    setUpdatingEchtedeelnemerId(deelnemerId);
    try {
      const res = await fetch('/api/deelnemers/echtedeelnemer', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: deelnemerId,
          echtedeelnemer: nextValue,
          idwaarneemgroep: wgId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Inroosteren wijzigen mislukt');
      }
      toast.success(nextValue ? 'Deelnemer wordt ingeroosterd.' : 'Deelnemer wordt niet ingeroosterd.');
    } catch (error) {
      setLeden((prev) =>
        prev.map((d) => (d.id === deelnemerId ? { ...d, echtedeelnemer: prevValue } : d))
      );
      toast.error(error instanceof Error ? error.message : 'Inroosteren wijzigen mislukt');
    } finally {
      setUpdatingEchtedeelnemerId(null);
    }
  }

  async function handleRolInGroepChange(deelnemerId: number, nextRolId: number, wgId: number) {
    let prevRolInWg: number | null = null;
    setLeden((prev) =>
      prev.map((d) => {
        if (d.id !== deelnemerId) return d;
        const idx = d.waarneemgroepen.findIndex((wg) => wg.id === wgId);
        if (idx === -1) return d;
        prevRolInWg = d.waarneemgroepen[idx]?.idgroep ?? null;
        const waarneemgroepen = [...d.waarneemgroepen];
        waarneemgroepen[idx] = { ...waarneemgroepen[idx], idgroep: nextRolId };
        return { ...d, waarneemgroepen };
      })
    );

    setUpdatingRolId(deelnemerId);
    try {
      const res = await fetch('/api/deelnemers/registratie', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actie: 'groep',
          IDdeelnemer: deelnemerId,
          IDwaarneemgroep: wgId,
          IDgroep: nextRolId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Rol wijzigen mislukt');
      }
      toast.success('Rol in groep bijgewerkt.');
    } catch (error) {
      setLeden((prev) =>
        prev.map((d) => {
          if (d.id !== deelnemerId) return d;
          const idx = d.waarneemgroepen.findIndex((wg) => wg.id === wgId);
          if (idx === -1) return d;
          const waarneemgroepen = [...d.waarneemgroepen];
          waarneemgroepen[idx] = { ...waarneemgroepen[idx], idgroep: prevRolInWg };
          return { ...d, waarneemgroepen };
        })
      );
      toast.error(error instanceof Error ? error.message : 'Rol wijzigen mislukt');
    } finally {
      setUpdatingRolId(null);
    }
  }

  async function handleFunctieChange(deelnemerId: number, nextFunctie: number | null, wgId: number) {
    let prevFunctieInWg: number | null = null;
    setLeden((prev) =>
      prev.map((d) => {
        if (d.id !== deelnemerId) return d;
        const idx = d.waarneemgroepen.findIndex((wg) => wg.id === wgId);
        if (idx === -1) return d;
        prevFunctieInWg = d.waarneemgroepen[idx]?.idfunctie ?? null;
        const waarneemgroepen = [...d.waarneemgroepen];
        waarneemgroepen[idx] = { ...waarneemgroepen[idx], idfunctie: nextFunctie };
        return { ...d, waarneemgroepen };
      })
    );

    setUpdatingFunctieId(deelnemerId);
    try {
      const res = await fetch('/api/deelnemers/registratie', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actie: 'functie',
          IDdeelnemer: deelnemerId,
          IDwaarneemgroep: wgId,
          IDfunctie: nextFunctie,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Functie wijzigen mislukt');
      }
      toast.success('Functie bijgewerkt.');
    } catch (error) {
      setLeden((prev) =>
        prev.map((d) => {
          if (d.id !== deelnemerId) return d;
          const idx = d.waarneemgroepen.findIndex((wg) => wg.id === wgId);
          if (idx === -1) return d;
          const waarneemgroepen = [...d.waarneemgroepen];
          waarneemgroepen[idx] = { ...waarneemgroepen[idx], idfunctie: prevFunctieInWg };
          return { ...d, waarneemgroepen };
        })
      );
      toast.error(error instanceof Error ? error.message : 'Functie wijzigen mislukt');
    } finally {
      setUpdatingFunctieId(null);
    }
  }

  function requestRemoveFromWg(deelnemerId: number) {
    setConfirmRemoveId(deelnemerId);
  }

  function requestDeleteMembership(deelnemerId: number, membershipCount: number) {
    setConfirmDeleteId(deelnemerId);
    setConfirmDeleteIsLast(membershipCount === 1);
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
        toast.error(typeof data.error === 'string' ? data.error : 'E-mail verificatiemail versturen mislukt');
        return;
      }
      toast.success('E-mail verificatiemail opnieuw verstuurd.');
      if (data.emailVerified === true) {
        setLeden((prev) => prev.map((row) => (row.id === d.id ? { ...row, emailVerified: true } : row)));
      }
    } catch {
      toast.error('E-mail verificatiemail versturen mislukt');
    } finally {
      setResendingVerificationId(null);
    }
  }

  function openAddModal() {
    setSubmitError(null);
    setIsAddModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const msg = validateClient();
    if (msg) {
      setSubmitError(msg);
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
      const fteRaw = fteDraft !== undefined ? fteDraft : formatFteDisplay(fte);
      let fteCommitted = parseFteInputToNumber(fteRaw);
      if (fteCommitted === null) fteCommitted = fte;
      fteCommitted = commitFteNumber(fteCommitted);

      const parsedFunctie = idfunctie === '' ? null : Number(idfunctie);
      const idfunctiePayload =
        parsedFunctie === 1 || parsedFunctie === 2 || parsedFunctie === 3 || parsedFunctie === 4
          ? parsedFunctie
          : null;

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
          geslacht: geslacht ?? null,
          idgroep: idRol,
          idwaarneemgroep: idWG,
          bestaatInAndereWaarneemgroep,
          fte: fteCommitted,
          idfunctie: idfunctiePayload,
          inviteInitiatedOrigin:
            typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg =
          typeof body?.error === 'string' ? body.error : `Fout (${res.status})`;
        setSubmitError(errMsg);
        toast.error(errMsg);
        return;
      }
      const outcome =
        typeof (body as { outcome?: string }).outcome === 'string'
          ? (body as { outcome: string }).outcome
          : 'created';
      if (outcome === 'already-linked') {
        const errMsg =
          typeof (body as { message?: string }).message === 'string'
            ? (body as { message: string }).message
            : ALREADY_IN_WG_ERROR;
        setSubmitError(errMsg);
        toast.error(errMsg);
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
      setGeslacht(null);
      setIdgroep('');
      setIdfunctie('');
      setFte(1);
      setFteDraft(undefined);
      setBestaatInAndereWaarneemgroep(false);
      setSubmitError(null);
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
        <title>Deelnemers beheren</title>
      </Head>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl font-semibold tracking-tight">Deelnemers beheren</h1>
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

            {mayCreate && !isAdmin && isActiveGroupForbidden && (
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold tracking-tight">
                      Deelnemers in deze waarneemgroep
                      {selectedWgLabel ? ` — ${selectedWgLabel}` : ''}
                    </h2>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="toon-afgemelde"
                        className="inline-flex cursor-pointer items-center gap-2 text-sm font-normal text-foreground"
                      >
                        <Checkbox
                          id="toon-afgemelde"
                          checked={toonAfgemelde}
                          onCheckedChange={(checked) => setToonAfgemelde(checked === true)}
                        />
                        Afgemelde deelnemers
                      </label>
                      <button
                        type="button"
                        title="Nieuwe deelnemer"
                        aria-label="Nieuwe deelnemer"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
                        onClick={openAddModal}
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
                {!ledenLoading && !ledenError && sortedLeden.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {leden.length > 0 && !toonAfgemelde
                      ? 'Geen aangemelde deelnemers. Vink “Afgemelde deelnemers” aan om afgemelde leden te tonen.'
                      : 'Geen deelnemers gevonden voor deze groep.'}
                  </p>
                )}
                {!ledenLoading && !ledenError && sortedLeden.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Naam</th>
                          <th className="pb-2 pr-4 font-medium">Email</th>
                          <th className="pb-2 pr-4 font-medium">E-mail verificatie</th>
                          <th className="w-[6rem] pb-2 pr-4 font-medium">Kleur</th>
                          <th className="pb-2 pr-4 font-medium">Rol in groep</th>
                          <th className="pb-2 pr-4 font-medium">Functie</th>
                          <th className="pb-2 pr-4 font-medium">Ingeroosterd</th>
                          <th className="pb-2 pr-4 font-medium w-28">Registratie</th>
                          <th className="pb-2 font-medium w-12" aria-label="Verwijderen" />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedLeden.map((d) => {
                          const membershipInWg = d.waarneemgroepen.find((wg) => wg.id === wgNumeric);
                          const rolInWg = membershipInWg?.idgroep ?? null;
                          const functieInWg = membershipInWg?.idfunctie ?? null;
                          const isAangemeld = membershipInWg?.aangemeld === true;
                          const isSelf = Number.isFinite(myDeelnemerId) && d.id === myDeelnemerId;
                          const membershipCount = d.membershipCount ?? d.waarneemgroepen.length;
                          return (
                            <tr
                              key={d.id}
                              className={`border-b last:border-0 even:bg-muted/80 ${!isAangemeld ? 'opacity-70' : ''}`}
                            >
                              <td className="py-2.5 pr-4 font-medium">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-flex h-8 min-w-10 items-center justify-center rounded-md px-2 text-xs font-semibold text-white"
                                    style={{ backgroundColor: d.color || '#cccccc' }}
                                  >
                                    {deelnemerChipInitials(d, { maxFallbackLength: 3, fallback: '—' })}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openDeelnemerGegevens(d.id)}
                                    className="text-left font-medium hover:underline"
                                    title="Open gegevens van deze deelnemer"
                                  >
                                    {formatNaam(d)}
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 pr-4">
                                {d.login ? (
                                  <button
                                    type="button"
                                    onClick={() => openDeelnemerGegevens(d.id)}
                                    className="text-left text-muted-foreground hover:underline"
                                    title="Open gegevens van deze deelnemer"
                                  >
                                    {d.login}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
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
                              <td className="py-2.5 pr-4">
                                <select
                                  className="h-8 min-w-[7rem] rounded-md border border-input bg-background px-2 text-xs"
                                  value={rolInWg != null ? String(rolInWg) : ''}
                                  disabled={!isAangemeld || updatingRolId === d.id}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const nextRol = Number(e.target.value);
                                    if (!Number.isFinite(nextRol) || nextRol === rolInWg) return;
                                    void handleRolInGroepChange(d.id, nextRol, wgNumeric);
                                  }}
                                >
                                  <option value="" disabled>
                                    — Kies —
                                  </option>
                                  {rolInGroepChoices.map((choice) => (
                                    <option key={choice.id} value={String(choice.id)}>
                                      {ROL_LABELS[choice.id] ?? choice.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2.5 pr-4">
                                <select
                                  className="h-8 min-w-[7rem] rounded-md border border-input bg-background px-2 text-xs"
                                  value={functieInWg != null ? String(functieInWg) : ''}
                                  disabled={!isAangemeld || updatingFunctieId === d.id}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const raw = e.target.value;
                                    const nextFunctie = raw === '' ? null : Number(raw);
                                    if (nextFunctie === functieInWg) return;
                                    if (nextFunctie !== null && !Number.isFinite(nextFunctie)) return;
                                    void handleFunctieChange(d.id, nextFunctie, wgNumeric);
                                  }}
                                >
                                  <option value="">— Geen —</option>
                                  {functieChoices.map((choice) => (
                                    <option key={choice.id} value={String(choice.id)}>
                                      {choice.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2.5 pr-4">
                                <div
                                  className="flex items-center gap-2"
                                  title="Wordt wel ingeroosterd (zichtbaar op rooster maken secretaris)"
                                >
                                  <Checkbox
                                    checked={d.echtedeelnemer === true}
                                    disabled={!isAangemeld || updatingEchtedeelnemerId === d.id}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    onCheckedChange={(checked) => {
                                      void handleEchtedeelnemerChange(d.id, checked === true, wgNumeric);
                                    }}
                                  />
                                  <span className="text-xs text-muted-foreground">Rooster</span>
                                </div>
                              </td>
                              <td className="py-2.5 pr-4">
                                {!isAangemeld && (
                                  <span className="mb-1 block text-xs text-muted-foreground">Afgemeld</span>
                                )}
                                {isSelf ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : isAangemeld ? (
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 text-xs"
                                    disabled={removingId === d.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      requestRemoveFromWg(d.id);
                                    }}
                                  >
                                    {removingId === d.id ? 'Bezig…' : 'Afmelden'}
                                  </Button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={registeringId === d.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleRegisterInWg(d.id);
                                    }}
                                    className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-xs font-medium text-white transition-all disabled:pointer-events-none disabled:opacity-50"
                                    style={{ backgroundColor: BRAND }}
                                  >
                                    {registeringId === d.id ? 'Bezig…' : 'Aanmelden'}
                                  </button>
                                )}
                              </td>
                              <td className="py-2.5">
                                {isSelf ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    disabled={deletingMembershipId === d.id}
                                    title="Lidmaatschap verwijderen"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      requestDeleteMembership(d.id, membershipCount);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
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
              Weet u zeker dat u deze deelnemer uit deze waarneemgroep wilt afmelden? De deelnemer blijft
              zichtbaar in de lijst en kan later opnieuw worden aangemeld.
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
      {confirmDeleteId != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Bevestig verwijderen lidmaatschap"
          onClick={() => {
            if (deletingMembershipId == null) {
              setConfirmDeleteId(null);
              setConfirmDeleteIsLast(false);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold tracking-tight">
              {confirmDeleteIsLast ? 'Deelnemer volledig verwijderen' : 'Lidmaatschap verwijderen'}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {confirmDeleteIsLast
                ? 'Dit is het laatste lidmaatschap van deze deelnemer. De deelnemer wordt volledig uit het systeem verwijderd, inclusief login en gegevens.'
                : 'Weet u zeker dat u dit lidmaatschap uit deze waarneemgroep wilt verwijderen? De deelnemer blijft lid van andere waarneemgroepen.'}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={deletingMembershipId != null}
                onClick={() => {
                  setConfirmDeleteId(null);
                  setConfirmDeleteIsLast(false);
                }}
              >
                Annuleren
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deletingMembershipId != null}
                onClick={() => void handleDeleteMembership(confirmDeleteId, confirmDeleteIsLast)}
              >
                {deletingMembershipId != null
                  ? 'Bezig…'
                  : confirmDeleteIsLast
                    ? 'Ja, volledig verwijderen'
                    : 'Ja, verwijderen'}
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
          aria-label="Nieuwe deelnemer"
          onClick={() => {
            if (!submitting) {
              setSubmitError(null);
              setIsAddModalOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-2xl rounded-xl border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Nieuwe deelnemer</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSubmitError(null);
                  setIsAddModalOpen(false);
                }}
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (submitError) setSubmitError(null);
                  }}
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
                <div className="grid gap-2">
                  <Label htmlFor="functie-add">Functie</Label>
                  <select
                    id="functie-add"
                    className={selectClass}
                    value={idfunctie}
                    onChange={(e) => setIdfunctie(e.target.value)}
                    disabled={submitting}
                  >
                    <option value="">— Geen —</option>
                    {functieChoices.map((choice) => (
                      <option key={choice.id} value={String(choice.id)}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fte-add">FTE (0–2)</Label>
                  <Input
                    id="fte-add"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={fteDraft !== undefined ? fteDraft : formatFteDisplay(fte)}
                    onChange={(e) => {
                      const sanitized = sanitizeFteInputString(e.target.value);
                      setFteDraft(sanitized);
                      const n = parseFteInputToNumber(sanitized);
                      if (n !== null) {
                        setFte(Math.min(2, Math.max(0, n)));
                      }
                    }}
                    onBlur={(e) => {
                      const raw = e.target.value;
                      let n = parseFteInputToNumber(raw);
                      if (n === null) n = fte;
                      const committed = commitFteNumber(n);
                      setFte(committed);
                      setFteDraft(undefined);
                    }}
                    disabled={submitting}
                  />
                </div>
              </div>

              {!bestaatInAndereWaarneemgroep && (
                <>
                  <div className="grid gap-2">
                    <Label>Geslacht</Label>
                    <div className="flex gap-4">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="geslacht-add"
                          checked={geslacht === 0}
                          onChange={() => setGeslacht(0)}
                          disabled={submitting}
                          className="accent-primary"
                        />
                        man
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="geslacht-add"
                          checked={geslacht === 1}
                          onChange={() => setGeslacht(1)}
                          disabled={submitting}
                          className="accent-primary"
                        />
                        vrouw
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="geslacht-add"
                          checked={geslacht === null}
                          onChange={() => setGeslacht(null)}
                          disabled={submitting}
                          className="accent-primary"
                        />
                        X
                      </label>
                    </div>
                  </div>
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
                        disabled={submitting}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="voorletterstussenvoegsel">voorletters & tussenvoegsel</Label>
                      <Input
                        id="voorletterstussenvoegsel"
                        value={tussen}
                        onChange={(e) => setTussen(e.target.value)}
                        maxLength={50}
                        disabled={submitting}
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
                        disabled={submitting}
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
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </>
              )}

              {submitError && (
                <p className="text-sm text-destructive" role="alert">
                  {submitError}
                </p>
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
