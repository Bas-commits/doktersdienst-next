'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useMemo, useRef } from 'react';
import { ChevronRight, ChevronDown, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordChangeModal } from '@/components/mijn-gegevens/PasswordChangeModal';
import { UnsavedChangesModal } from '@/components/mijn-gegevens/UnsavedChangesModal';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import type { MijnGegevensProfile, MijnGegevensLookup, MijnGegevensUpdateBody, TelnrSlot } from '@/types/mijn-gegevens';
import { ROL_LABELS } from '@/lib/rol-labels';
import { BEHEERDER_WIJZIGT_ANDERMANS_EMAIL_TEKST } from '@/lib/beheerder-contact';

const TELNR_SPECIAL_TYPES = [
  { id: 1001, naam: 'Mobiel' },
  { id: 1003, naam: 'Thuis' },
  { id: 1010, naam: 'Maxer' },
];

const DEFAULT_SLOT: TelnrSlot = {
  telnr: '',
  smsontvanger: false,
  idInstellingtype: 1001,
  idLocatie: null,
  locatieSuffix: 'binnen',
  idomschrtelnr: 2,
};

const ROL_BADGE_CLASSES: Record<number, string> = {
  1: 'bg-primary/10 text-primary',
  2: 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200',
  3: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  4: 'bg-muted text-muted-foreground',
};

const FUNCTIE_OPTIONS = [
  { id: 1 as const, label: 'Ajo' },
  { id: 2 as const, label: 'Specialist' },
  { id: 3 as const, label: 'Assisitent' },
  { id: 4 as const, label: 'Toa' },
];

const formSectionClass =
  'rounded-xl border border-border bg-muted/30 p-4 space-y-4 shadow-sm dark:bg-muted/20';

type FormSnapshot = {
  color: string;
  achternaam: string;
  voorletterstussenvoegsel: string;
  voornaam: string;
  initialen: string;
  geslacht: 0 | 1 | null;
  idlocatie: number;
  huisadrstraatnr: string;
  huisadrpostcode: string;
  huisadrplaats: string;
  huisadrtelnr: string;
  huisadrfax: string;
  huisemail: string;
  echtedeelnemer: boolean;
  smsdienstbegin: boolean;
  callRecording: boolean;
  telnrSlots: TelnrSlot[];
  fteByWaarneemgroepId: Record<number, number>;
  functieByWaarneemgroepId: Record<number, 1 | 2 | 3 | 4 | null>;
  expertiseIdsByWaarneemgroepId: Record<number, number[]>;
};

function defaultFteForWaarneemgroepen(
  waarneemgroepen: MijnGegevensProfile['waarneemgroepen']
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const wg of waarneemgroepen) {
    const v = wg.fte;
    out[wg.id] =
      typeof v === 'number' && Number.isFinite(v) ? Math.min(2, Math.max(0, v)) : 1;
  }
  return out;
}

function defaultFunctieForWaarneemgroepen(
  waarneemgroepen: MijnGegevensProfile['waarneemgroepen']
): Record<number, 1 | 2 | 3 | 4 | null> {
  const out: Record<number, 1 | 2 | 3 | 4 | null> = {};
  for (const wg of waarneemgroepen) {
    const v = wg.idfunctie;
    out[wg.id] = v === 1 || v === 2 || v === 3 || v === 4 ? v : null;
  }
  return out;
}

function fteRecordsDirty(a: Record<number, number>, b: Record<number, number>): boolean {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)].map(Number));
  for (const id of ids) {
    const x = a[id];
    const y = b[id];
    if (x === undefined || y === undefined) return true;
    if (Math.abs(x - y) > 1e-6) return true;
  }
  return false;
}

function functieRecordsDirty(
  a: Record<number, 1 | 2 | 3 | 4 | null>,
  b: Record<number, 1 | 2 | 3 | 4 | null>
): boolean {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)].map(Number));
  for (const id of ids) {
    if ((a[id] ?? null) !== (b[id] ?? null)) return true;
  }
  return false;
}

function defaultExpertiseIdsForWaarneemgroepen(
  waarneemgroepen: MijnGegevensProfile['waarneemgroepen']
): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  for (const wg of waarneemgroepen) {
    out[wg.id] = [...(wg.selectedExpertiseIds ?? [])].sort((a, b) => a - b);
  }
  return out;
}

function expertiseRecordsDirty(
  a: Record<number, number[]>,
  b: Record<number, number[]>
): boolean {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)].map(Number));
  for (const id of ids) {
    const left = [...(a[id] ?? [])].sort((x, y) => x - y);
    const right = [...(b[id] ?? [])].sort((x, y) => x - y);
    if (left.length !== right.length) return true;
    for (let i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) return true;
    }
  }
  return false;
}

function cloneExpertiseIdsMap(map: Record<number, number[]>): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  for (const [key, value] of Object.entries(map)) {
    out[Number(key)] = [...value];
  }
  return out;
}

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

/** Accept . and , as decimal separator; cap to one separator and two fraction digits */
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

const STANDAARDKLEUR = '#cccccc';

/**
 * Geeft de opgeslagen kleur terug, of null als er niets bruikbaars staat.
 *
 * 180 deelnemers hebben een lege string in de kolom staan, geen NULL. Die
 * glipte langs `?? STANDAARDKLEUR` heen en werd zo teruggestuurd naar de
 * server, die alleen zes hexcijfers accepteert. Daardoor kon het profiel van
 * die deelnemers helemaal niet meer worden opgeslagen.
 */
function geldigeKleur(waarde: string | null): string | null {
  const kleur = (waarde ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(kleur) ? kleur : null;
}

function RequiredAsterisk() {
  return <span className="text-[#c91b23]">*</span>;
}

export default function MijnGegevensPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [profile, setProfile] = useState<MijnGegevensProfile | null>(null);
  const [lookup, setLookup] = useState<MijnGegevensLookup | null>(null);
  const [isDelegatedEdit, setIsDelegatedEdit] = useState(false);
  const [canEditEchtedeelnemer, setCanEditEchtedeelnemer] = useState(false);
  const [canEditEmail, setCanEditEmail] = useState(false);
  const [canEditPassword, setCanEditPassword] = useState(false);
  const [requiresCurrentPassword, setRequiresCurrentPassword] = useState(true);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [pendingEmailChange, setPendingEmailChange] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<FormSnapshot | null>(null);

  // Form state – initialised from profile when loaded
  const [color, setColor] = useState(STANDAARDKLEUR);
  /**
   * Onwaar zolang er geen kleur op de deelnemer staat. Het scherm toont dan de
   * standaardkleur, maar schrijft die niet weg: een kleur die niemand heeft
   * gekozen hoort geen kleur te worden alleen omdat er iets anders is opgeslagen.
   */
  const [kleurGekozen, setKleurGekozen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [waarneemgroepenOpen, setWaarneemgroepenOpen] = useState(false);
  const [expertisesOpen, setExpertisesOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [achternaam, setAchternaam] = useState('');
  const [voorletterstussenvoegsel, setVoorletterstussenvoegsel] = useState('');
  const [voornaam, setVoornaam] = useState('');
  const [initialen, setInitialen] = useState('');
  const [geslacht, setGeslacht] = useState<0 | 1 | null>(null);
  const [locatieSuffix, setLocatieSuffix] = useState<'binnen' | 'buiten'>('binnen');
  const [locatieIdInstellingtype, setLocatieIdInstellingtype] = useState<number>(-1);
  const [idlocatie, setIdlocatie] = useState<number>(-1);
  const [huisadrstraatnr, setHuisadrstraatnr] = useState('');
  const [huisadrpostcode, setHuisadrpostcode] = useState('');
  const [huisadrplaats, setHuisadrplaats] = useState('');
  const [huisadrtelnr, setHuisadrtelnr] = useState('');
  const [huisadrfax, setHuisadrfax] = useState('');
  const [huisemail, setHuisemail] = useState('');
  const [echtedeelnemer, setEchtedeelnemer] = useState(false);
  const [smsdienstbegin, setSmsdienstbegin] = useState(false);
  const [callRecording, setCallRecording] = useState(false);
  const [telnrSlots, setTelnrSlots] = useState<TelnrSlot[]>([{ ...DEFAULT_SLOT }]);
  const [fteByWaarneemgroepId, setFteByWaarneemgroepId] = useState<Record<number, number>>({});
  const [functieByWaarneemgroepId, setFunctieByWaarneemgroepId] = useState<
    Record<number, 1 | 2 | 3 | 4 | null>
  >({});
  const [expertiseIdsByWaarneemgroepId, setExpertiseIdsByWaarneemgroepId] = useState<
    Record<number, number[]>
  >({});
  /** Raw string while editing (comma decimal); undefined = show formatted from fteByWaarneemgroepId */
  const [fteDraftByWgId, setFteDraftByWgId] = useState<Partial<Record<number, string>>>({});
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  const delegatedDeelnemerId = useMemo(() => {
    if (!router.isReady) return null;
    const raw = router.query.deelnemerId;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value) return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
  }, [router.isReady, router.query.deelnemerId]);

  const apiPath = useMemo(() => {
    if (delegatedDeelnemerId == null) return '/api/mijn-gegevens';
    return `/api/mijn-gegevens?deelnemerId=${delegatedDeelnemerId}`;
  }, [delegatedDeelnemerId]);

  useEffect(() => {
    if (!session?.user || !router.isReady) return;
    let cancelled = false;
    fetch(apiPath, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setProfile(null);
          setLookup(null);
          return;
        }
        const { profile: profileRes, lookup: lookupRes } = data;
        setIsDelegatedEdit(data.isDelegatedEdit === true);
        setCanEditEchtedeelnemer(data.canEditEchtedeelnemer === true);
        setCanEditEmail(data.canEditEmail === true);
        setCanEditPassword(data.canEditPassword === true);
        setRequiresCurrentPassword(data.requiresCurrentPassword !== false);
        setEmailVerified(data.emailVerified ?? null);
        setPendingEmailChange(null);
        setProfile(profileRes);
        setLookup(lookupRes);
        const initialLogin = profileRes.deelnemer.login ?? '';
        // Is huisemail leeg, dan is de login het beste alternatief; die is bij de
        // meeste deelnemers hetzelfde adres. Het adres van de ingelogde gebruiker
        // is dat alleen op je eigen profiel. Op dat van een ander vulde het jouw
        // adres in bij iedereen die er zelf geen had, en dat is niet leeg maar
        // onwaar: het scherm beweerde iets over een deelnemer dat niet klopte.
        const eigenSessieEmail =
          typeof session.user.email === 'string' ? session.user.email.trim() : '';
        const initialHuisemail =
          (profileRes.deelnemer.huisemail ?? '').trim() ||
          (initialLogin.includes('@') ? initialLogin : '') ||
          (data.isDelegatedEdit === true ? '' : eigenSessieEmail);
        const opgeslagenKleur = geldigeKleur(profileRes.deelnemer.color);
        setColor(opgeslagenKleur ?? STANDAARDKLEUR);
        setKleurGekozen(opgeslagenKleur !== null);
        setAchternaam(profileRes.deelnemer.achternaam ?? '');
        setVoorletterstussenvoegsel(profileRes.deelnemer.voorletterstussenvoegsel ?? '');
        setVoornaam(profileRes.deelnemer.voornaam ?? '');
        setInitialen(profileRes.deelnemer.initialen ?? '');
        setGeslacht(profileRes.deelnemer.geslacht === true ? 1 : profileRes.deelnemer.geslacht === false ? 0 : null);
        setLocatieSuffix(profileRes.locatieSuffix ?? 'binnen');
        const loc = profileRes.locatie;
        const typeId = loc?.idinstellingtype ?? -1;
        setLocatieIdInstellingtype(typeId);
        setIdlocatie(profileRes.deelnemer.idlocatie ?? -1);
        setHuisadrstraatnr(profileRes.deelnemer.huisadrstraatnr ?? '');
        setHuisadrpostcode(profileRes.deelnemer.huisadrpostcode ?? '');
        setHuisadrplaats(profileRes.deelnemer.huisadrplaats ?? '');
        setHuisadrtelnr(profileRes.deelnemer.huisadrtelnr ?? '');
        setHuisadrfax(profileRes.deelnemer.huisadrfax ?? '');
        setHuisemail(initialHuisemail);
        setEchtedeelnemer(profileRes.deelnemer.echtedeelnemer === true);
        setSmsdienstbegin(profileRes.deelnemer.smsdienstbegin === true);
        setCallRecording(profileRes.deelnemer.callRecording === true);
        const initialSlots = profileRes.telnrSlots.length > 0 ? profileRes.telnrSlots : [{ ...DEFAULT_SLOT }];
        setTelnrSlots(initialSlots);
        const initialFte = defaultFteForWaarneemgroepen(profileRes.waarneemgroepen);
        const initialFunctie = defaultFunctieForWaarneemgroepen(profileRes.waarneemgroepen);
        const initialExpertises = defaultExpertiseIdsForWaarneemgroepen(profileRes.waarneemgroepen);
        setFteByWaarneemgroepId(initialFte);
        setFunctieByWaarneemgroepId(initialFunctie);
        setExpertiseIdsByWaarneemgroepId(initialExpertises);
        setFteDraftByWgId({});
        setSavedSnapshot({
          color: opgeslagenKleur ?? STANDAARDKLEUR,
          achternaam: profileRes.deelnemer.achternaam ?? '',
          voorletterstussenvoegsel: profileRes.deelnemer.voorletterstussenvoegsel ?? '',
          voornaam: profileRes.deelnemer.voornaam ?? '',
          initialen: profileRes.deelnemer.initialen ?? '',
          geslacht: profileRes.deelnemer.geslacht === true ? 1 : profileRes.deelnemer.geslacht === false ? 0 : null,
          idlocatie: profileRes.deelnemer.idlocatie ?? -1,
          huisadrstraatnr: profileRes.deelnemer.huisadrstraatnr ?? '',
          huisadrpostcode: profileRes.deelnemer.huisadrpostcode ?? '',
          huisadrplaats: profileRes.deelnemer.huisadrplaats ?? '',
          huisadrtelnr: profileRes.deelnemer.huisadrtelnr ?? '',
          huisadrfax: profileRes.deelnemer.huisadrfax ?? '',
          huisemail: initialHuisemail,
          echtedeelnemer: profileRes.deelnemer.echtedeelnemer === true,
          smsdienstbegin: profileRes.deelnemer.smsdienstbegin === true,
          callRecording: profileRes.deelnemer.callRecording === true,
          telnrSlots: initialSlots,
          fteByWaarneemgroepId: { ...initialFte },
          functieByWaarneemgroepId: { ...initialFunctie },
          expertiseIdsByWaarneemgroepId: cloneExpertiseIdsMap(initialExpertises),
        });
        if (typeId === -1 && lookupRes?.instellingtypen?.length > 0) {
          const firstId = lookupRes.instellingtypen[0]?.id ?? -1;
          if (firstId !== -1) setLocatieIdInstellingtype(firstId);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Laden mislukt');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user, router.isReady, delegatedDeelnemerId, apiPath]);

  const totalWaarneemFte = useMemo(() => {
    if (!profile?.waarneemgroepen?.length) return null;
    return profile.waarneemgroepen.reduce((sum, wg) => sum + (fteByWaarneemgroepId[wg.id] ?? 1), 0);
  }, [profile, fteByWaarneemgroepId]);

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false;
    const s = savedSnapshot;
    return (
      color !== s.color ||
      achternaam !== s.achternaam ||
      voorletterstussenvoegsel !== s.voorletterstussenvoegsel ||
      voornaam !== s.voornaam ||
      initialen !== s.initialen ||
      geslacht !== s.geslacht ||
      idlocatie !== s.idlocatie ||
      huisadrstraatnr !== s.huisadrstraatnr ||
      huisadrpostcode !== s.huisadrpostcode ||
      huisadrplaats !== s.huisadrplaats ||
      huisadrtelnr !== s.huisadrtelnr ||
      huisadrfax !== s.huisadrfax ||
      huisemail !== s.huisemail ||
      echtedeelnemer !== s.echtedeelnemer ||
      smsdienstbegin !== s.smsdienstbegin ||
      callRecording !== s.callRecording ||
      JSON.stringify(telnrSlots) !== JSON.stringify(s.telnrSlots) ||
      fteRecordsDirty(fteByWaarneemgroepId, s.fteByWaarneemgroepId) ||
      functieRecordsDirty(functieByWaarneemgroepId, s.functieByWaarneemgroepId) ||
      expertiseRecordsDirty(expertiseIdsByWaarneemgroepId, s.expertiseIdsByWaarneemgroepId)
    );
  }, [
    savedSnapshot,
    color,
    achternaam,
    voorletterstussenvoegsel,
    voornaam,
    initialen,
    geslacht,
    idlocatie,
    huisadrstraatnr,
    huisadrpostcode,
    huisadrplaats,
    huisadrtelnr,
    huisadrfax,
    huisemail,
    echtedeelnemer,
    smsdienstbegin,
    callRecording,
    telnrSlots,
    fteByWaarneemgroepId,
    functieByWaarneemgroepId,
    expertiseIdsByWaarneemgroepId,
  ]);

  const {
    pendingNavUrl,
    cancelNavigation,
    proceedWithoutSaving,
    proceedAfterSave,
  } = useUnsavedChangesGuard(isDirty);

  const locatieOptionsBinnen = useMemo(() => {
    if (!lookup || locatieIdInstellingtype === -1) return [];
    return lookup.locatiesPerTypeBinnen[locatieIdInstellingtype] ?? [];
  }, [lookup, locatieIdInstellingtype]);

  const locatieOptionsBuiten = useMemo(() => {
    if (!lookup || locatieIdInstellingtype === -1) return [];
    return lookup.locatiesPerTypeBuiten[locatieIdInstellingtype] ?? [];
  }, [lookup, locatieIdInstellingtype]);

  const currentLocatieOptions = locatieSuffix === 'binnen' ? locatieOptionsBinnen : locatieOptionsBuiten;

  const handleLocatieTypeChange = (typeId: number) => {
    setLocatieIdInstellingtype(typeId);
    setIdlocatie(-1);
  };

  const handleLocatieSelectChange = (value: number) => {
    setIdlocatie(value);
    if (value === 0) {
      if (locatieSuffix === 'binnen') {
        setLocatieSuffix('buiten');
        setIdlocatie(0);
      } else {
        setLocatieSuffix('binnen');
        setIdlocatie(0);
      }
    }
  };

  function addSlot() {
    setTelnrSlots((prev) => (prev.length < 5 ? [...prev, { ...DEFAULT_SLOT }] : prev));
  }

  function removeSlot(i: number) {
    setTelnrSlots((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function updateSlot(i: number, patch: Partial<TelnrSlot>) {
    setTelnrSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function handleSlotLocatieChange(i: number, newLocatieId: number) {
    if (newLocatieId === 0) {
      const cur = telnrSlots[i];
      const newSuffix = cur.locatieSuffix === 'binnen' ? 'buiten' : 'binnen';
      updateSlot(i, { locatieSuffix: newSuffix, idLocatie: null });
    } else {
      updateSlot(i, { idLocatie: newLocatieId });
    }
  }

  async function doSave(): Promise<boolean> {
    setIsSubmitting(true);

    const fteCommitted = { ...fteByWaarneemgroepId };
    const functieCommitted = { ...functieByWaarneemgroepId };
    for (const wg of profile?.waarneemgroepen ?? []) {
      const d = fteDraftByWgId[wg.id];
      const base = fteCommitted[wg.id] ?? 1;
      if (d !== undefined) {
        let n = parseFteInputToNumber(d);
        if (n === null) n = base;
        fteCommitted[wg.id] = commitFteNumber(n);
      } else {
        fteCommitted[wg.id] = commitFteNumber(base);
      }
      if (functieCommitted[wg.id] !== 1 && functieCommitted[wg.id] !== 2 && functieCommitted[wg.id] !== 3 && functieCommitted[wg.id] !== 4) {
        functieCommitted[wg.id] = null;
      }
    }

    const trimmedEmail = huisemail.trim();
    const savedEmail = savedSnapshot?.huisemail.trim() ?? '';
    const emailChanged = trimmedEmail.toLowerCase() !== savedEmail.toLowerCase();
    // Elk adres gaat via de bevestigingsmail, ook dat wat de beheerder voor een
    // ander invult. Anders zou niemand hebben aangetoond dat de deelnemer bij
    // dat nieuwe adres kan.
    const useVerifiedEmailChangeFlow = canEditEmail && emailChanged;

    if (useVerifiedEmailChangeFlow) {
      const emailRes = await fetch('/api/account/email-wijziging-aanvragen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          newEmail: trimmedEmail,
          ...(isDelegatedEdit ? { deelnemerId: delegatedDeelnemerId } : {}),
        }),
      });
      const emailData = await emailRes.json();
      if (!emailRes.ok) {
        setIsSubmitting(false);
        toast.error(emailData.error ?? 'E-mailwijziging aanvragen mislukt');
        return false;
      }
      setPendingEmailChange(trimmedEmail);
      toast.success(
        emailData.message ??
          `Verificatiemail verstuurd naar ${trimmedEmail}. Uw login wijzigt pas na bevestiging.`
      );
    }

    const body: MijnGegevensUpdateBody = {
      // Staat er nog geen kleur en heeft niemand er een gekozen, dan gaat het
      // veld niet mee. De standaardkleur is wat het scherm laat zien, geen keuze.
      color: kleurGekozen ? color : undefined,
      achternaam: achternaam.trim() || undefined,
      voorletterstussenvoegsel: voorletterstussenvoegsel.trim() || undefined,
      voornaam: voornaam.trim() || undefined,
      initialen: initialen.trim() || undefined,
      geslacht: geslacht ?? null,
      idlocatie: idlocatie !== -1 ? idlocatie : undefined,
      huisadrstraatnr: huisadrstraatnr.trim() || undefined,
      huisadrpostcode: huisadrpostcode.trim() || undefined,
      huisadrplaats: huisadrplaats.trim() || undefined,
      huisadrtelnr: huisadrtelnr.trim() || undefined,
      huisadrfax: huisadrfax.trim() || undefined,
      echtedeelnemer: canEditEchtedeelnemer ? echtedeelnemer : undefined,
      smsdienstbegin,
      callRecording,
      telnrSlots: telnrSlots
        .filter((s) => s.telnr.trim() !== '')
        .map((s) => ({
          telnr: s.telnr.trim(),
          smsontvanger: s.smsontvanger,
          idlocatietelnr: s.idLocatie ?? s.idInstellingtype,
          idomschrtelnr: s.idomschrtelnr,
        })),
      waarneemgroepFte:
        profile && profile.waarneemgroepen.length > 0
          ? profile.waarneemgroepen.map((wg) => ({
              idwaarneemgroep: wg.id,
              fte: fteCommitted[wg.id] ?? commitFteNumber(1),
              idfunctie: functieCommitted[wg.id] ?? null,
            }))
          : undefined,
      waarneemgroepExpertises:
        profile && profile.waarneemgroepen.length > 0
          ? profile.waarneemgroepen.map((wg) => ({
              idwaarneemgroep: wg.id,
              expertiseIds: [...(expertiseIdsByWaarneemgroepId[wg.id] ?? [])],
            }))
          : undefined,
    };
    // Wie het veld niet mag aanpassen stuurt het ook niet mee, anders zou het
    // scherm het onveranderde adres blijven terugschrijven bij elke opslag.
    if (canEditEmail && !useVerifiedEmailChangeFlow) {
      body.huisemail = trimmedEmail || undefined;
    }

    const res = await fetch(apiPath, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setIsSubmitting(false);

    if (!res.ok) {
      toast.error(data.error ?? 'Opslaan mislukt');
      return false;
    }

    if (!isDelegatedEdit && data.loginUpdated) {
      toast.success('Gegevens opgeslagen. Uw loginnaam is bijgewerkt naar uw e-mailadres.');
    } else if (!useVerifiedEmailChangeFlow) {
      toast.success('Gegevens opgeslagen.');
    }

    setFteByWaarneemgroepId(fteCommitted);
    setFunctieByWaarneemgroepId(functieCommitted);
    setFteDraftByWgId({});
    const expertiseCommitted = cloneExpertiseIdsMap(expertiseIdsByWaarneemgroepId);
    setExpertiseIdsByWaarneemgroepId(expertiseCommitted);
    setSavedSnapshot({
      color,
      achternaam,
      voorletterstussenvoegsel,
      voornaam,
      initialen,
      geslacht,
      idlocatie,
      huisadrstraatnr,
      huisadrpostcode,
      huisadrplaats,
      huisadrtelnr,
      huisadrfax,
      huisemail: useVerifiedEmailChangeFlow ? savedEmail : trimmedEmail,
      echtedeelnemer,
      smsdienstbegin,
      callRecording,
      telnrSlots,
      fteByWaarneemgroepId: { ...fteCommitted },
      functieByWaarneemgroepId: { ...functieCommitted },
      expertiseIdsByWaarneemgroepId: expertiseCommitted,
    });
    return true;
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    await doSave();
  }

  function handleSaveAndLeave() {
    void proceedAfterSave(doSave);
  }

  if (isPending || !session?.user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Mijn gegevens | Doktersdienst</title>
      </Head>
      <PasswordChangeModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        vraagHuidigWachtwoord={requiresCurrentPassword}
        deelnemerId={isDelegatedEdit ? delegatedDeelnemerId : null}
      />
      <UnsavedChangesModal
        open={pendingNavUrl != null}
        isSubmitting={isSubmitting}
        onCancel={cancelNavigation}
        onLeaveWithoutSaving={proceedWithoutSaving}
        onSaveAndLeave={handleSaveAndLeave}
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader className="flex flex-col gap-4 border-b border-border/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>
                <h1 className="text-2xl font-semibold tracking-tight">Gegevens deelnemer</h1>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {profile?.deelnemer.voornaam} {profile?.deelnemer.achternaam}
              </p>
            </div>
            <Button
              className="w-full cursor-pointer p-4 text-lg font-bold text-white sm:w-auto sm:shrink-0"
              type="submit"
              form="mijn-gegevens-form"
              disabled={isSubmitting || !isDirty}
              style={{
                background: 'linear-gradient(90deg, rgb(79, 27, 153) 0%, rgb(45, 34, 69) 100%)',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => {
                if (isSubmitting || !isDirty) return;
                (e.currentTarget as HTMLButtonElement).style.background =
                  'linear-gradient(90deg, rgb(56, 19, 108) 0%, rgb(45, 34, 69) 100%)';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'linear-gradient(90deg, rgb(79, 27, 153) 0%, rgb(45, 34, 69) 100%)';
              }}
            >
              {isSubmitting ? 'Opslaan…' : 'Opslaan'}
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {loading && !profile && (
              <p className="text-muted-foreground">Gegevens laden…</p>
            )}
            {error && !profile && (
              <p className="text-destructive" role="alert">
                {error}
              </p>
            )}
            {profile && lookup && (
              <form id="mijn-gegevens-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                

                <div className={formSectionClass}>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      {/* Verplicht op je eigen profiel: daar log je mee in. Op dat van
                          een ander niet, want er zijn deelnemers zonder adres, en dan
                          zou de beheerder er een moeten verzinnen om iets anders te
                          kunnen opslaan. */}
                      <Label htmlFor="huisemail" className="flex items-center gap-1.5">
                        E-mailadres/loginnaam{' '}
                        {!canEditEmail ? (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        ) : isDelegatedEdit ? null : (
                          <RequiredAsterisk />
                        )}
                      </Label>
                      {/* De hover hangt aan de omhullende div, want een disabled input
                          geeft zelf geen muisgebeurtenissen door. Geen title erbij: dat
                          zou de tekst een tweede keer tonen in het kadertje van de browser. */}
                      <div className="group relative" data-testid="huisemail-veld">
                        <Input
                          id="huisemail"
                          type="email"
                          value={huisemail}
                          onChange={(e) => setHuisemail(e.target.value)}
                          required={canEditEmail && !isDelegatedEdit}
                          disabled={isSubmitting || !canEditEmail}
                          aria-describedby={canEditEmail ? undefined : 'huisemail-uitleg'}
                          className={canEditEmail ? undefined : 'text-muted-foreground'}
                        />
                        {!canEditEmail && (
                          <span
                            role="tooltip"
                            id="huisemail-uitleg"
                            data-testid="huisemail-uitleg"
                            className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-full rounded-md bg-neutral-900 px-3 py-2 text-xs leading-snug text-white shadow-lg group-hover:block dark:bg-neutral-700"
                          >
                            {BEHEERDER_WIJZIGT_ANDERMANS_EMAIL_TEKST}
                          </span>
                        )}
                      </div>
                      {!isDelegatedEdit && emailVerified === true && (
                        <p className="text-xs text-muted-foreground">
                          Een nieuw adres gaat pas in nadat u de bevestigingslink volgt die u
                          daarop krijgt. Uw huidige adres krijgt een melding dat de wijziging
                          loopt. Uw wachtwoord blijft hetzelfde.
                        </p>
                      )}
                      {!isDelegatedEdit && emailVerified !== true && (
                        <p className="text-xs text-muted-foreground">
                          Bevestig eerst uw huidige e-mailadres. Daarna kunt u het hier wijzigen.
                        </p>
                      )}
                      {isDelegatedEdit && canEditEmail && (
                        <p className="text-xs text-muted-foreground">
                          Het nieuwe adres krijgt een bevestigingsmail en gaat pas in als de
                          deelnemer die link volgt. Zo blijkt of hij er echt bij kan. Het
                          huidige adres krijgt een melding.
                        </p>
                      )}
                      {pendingEmailChange && (
                        <p className="text-xs text-amber-800 dark:text-amber-200" role="status">
                          Bevestigingsmail verstuurd naar {pendingEmailChange}. De login wijzigt pas
                          na bevestiging.
                        </p>
                      )}
                    </div>
                  </div>
                  {canEditPassword && (
                    <div className="flex flex-col gap-1.5 border-t border-border/60 pt-4">
                      <Label>Wachtwoord</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        onClick={() => setPasswordModalOpen(true)}
                        disabled={isSubmitting}
                      >
                        Wijzig wachtwoord
                      </Button>
                      {isDelegatedEdit && (
                        <p className="text-xs text-muted-foreground">
                          Als beheerder zet u hier een nieuw wachtwoord zonder het huidige te
                          kennen.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className={formSectionClass}>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Label>Geslacht</Label>
                      <div className="flex gap-4">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="geslacht"
                            checked={geslacht === 0}
                            onChange={() => setGeslacht(0)}
                            disabled={isSubmitting}
                            className="accent-primary"
                          />
                          man
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="geslacht"
                            checked={geslacht === 1}
                            onChange={() => setGeslacht(1)}
                            disabled={isSubmitting}
                            className="accent-primary"
                          />
                          vrouw
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="geslacht"
                            checked={geslacht === null}
                            onChange={() => setGeslacht(null)}
                            disabled={isSubmitting}
                            className="accent-primary"
                          />
                          X
                        </label>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Label>Kleur</Label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title="Wijzig kleur"
                          onClick={() => colorInputRef.current?.click()}
                          disabled={isSubmitting}
                          className="h-6 w-10 rounded border border-input shadow-sm transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ backgroundColor: color }}
                        />
                        <input
                          ref={colorInputRef}
                          type="color"
                          className="sr-only"
                          value={color}
                          onChange={(e) => {
                            setColor(e.target.value);
                            setKleurGekozen(true);
                          }}
                          disabled={isSubmitting}
                        />
                        <button
                          type="button"
                          onClick={() => colorInputRef.current?.click()}
                          disabled={isSubmitting}
                          className="text-xs text-muted-foreground underline hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Wijzig
                        </button>
                      </div>
                    </div>
                  </div>
                  {canEditEchtedeelnemer && (
                    <div className="flex items-center gap-2 border-t border-border/60 pt-4">
                      <Checkbox
                        id="echtedeelnemer"
                        checked={echtedeelnemer}
                        onCheckedChange={(c) => setEchtedeelnemer(!!c)}
                        disabled={isSubmitting}
                      />
                      <Label htmlFor="echtedeelnemer" className="cursor-pointer text-sm">
                        Ingeroosterd (zichtbaar op rooster maken secretaris)
                      </Label>
                    </div>
                  )}
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                  
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-[140px]">
                      <Label htmlFor="voornaam">Voornaam <RequiredAsterisk /></Label>
                      <Input
                        id="voornaam"
                        type="text"
                        value={voornaam}
                        onChange={(e) => setVoornaam(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-[140px]">
                      <Label htmlFor="voorletterstussenvoegsel">voorletters & tussenvoegsel</Label>
                      <Input
                        id="voorletterstussenvoegsel"
                        type="text"
                        value={voorletterstussenvoegsel}
                        onChange={(e) => setVoorletterstussenvoegsel(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-[140px]">
                      <Label htmlFor="achternaam">Achternaam <RequiredAsterisk /></Label>
                      <Input
                        id="achternaam"
                        type="text"
                        value={achternaam}
                        onChange={(e) => setAchternaam(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-[100px]">
                      <Label htmlFor="initialen">Initialen <RequiredAsterisk /></Label>
                      <Input
                        id="initialen"
                        type="text"
                        value={initialen}
                        onChange={(e) => setInitialen(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  {/* <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-[100px]">
                      <Label htmlFor="functie">Functie <RequiredAsterisk /></Label>
                      <Input
                        id="Functie"
                        type="text"
                        value={Functie}
                        onChange={(e) => setFunctie(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div> */}
                  
                  {/* <div className="flex flex-col gap-1">
                    <Label htmlFor="locatieType">Locatie (waar u het meest werkt)</Label>
                    <div className="flex flex-wrap w-1/2 items-center gap-2">
                      <select
                        id="locatieType"
                        value={locatieIdInstellingtype === -1 ? '' : locatieIdInstellingtype}
                        onChange={(e) =>
                          handleLocatieTypeChange(
                            e.target.value === '' ? -1 : Number(e.target.value)
                          )
                        }
                        className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base md:text-sm"
                        disabled={isSubmitting}
                      >
                        <option value="">--</option>
                        {lookup.instellingtypen.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.naam ?? `Type ${t.id}`}
                          </option>
                        ))}
                      </select>
                      {locatieIdInstellingtype >= 0 && currentLocatieOptions.length > 0 && (
                        <select
                          key={`${locatieSuffix}-${locatieIdInstellingtype}`}
                          value={idlocatie}
                          onChange={(e) => handleLocatieSelectChange(Number(e.target.value))}
                          className="h-8 min-w-[145px] rounded-lg border border-input bg-transparent px-2.5 py-1 text-base md:text-sm"
                          disabled={isSubmitting}
                        >
                          {currentLocatieOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.naam}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div> */}
                  <div className="overflow-hidden rounded-lg border border-border bg-background/80">
                    <button
                      type="button"
                      onClick={() => setAddressOpen((o) => !o)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50 rounded-t-lg aria-expanded:rounded-b-none"
                      aria-expanded={addressOpen}
                    >
                      {addressOpen ? (
                        <ChevronDown className="size-4 shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0" />
                      )}
                      Huisadres
                    </button>
                    {addressOpen && (
                      <div className="flex flex-col gap-1 border-t border-border px-3 py-2 rounded-b-lg">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="huisadrstraatnr">Straat en nummer</Label>
                          <Input
                            id="huisadrstraatnr"
                            type="text"
                            value={huisadrstraatnr}
                            onChange={(e) => setHuisadrstraatnr(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="huisadrpostcode">Postcode</Label>
                          <Input
                            id="huisadrpostcode"
                            type="text"
                            value={huisadrpostcode}
                            onChange={(e) => setHuisadrpostcode(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="huisadrplaats">Plaats</Label>
                          <Input
                            id="huisadrplaats"
                            type="text"
                            value={huisadrplaats}
                            onChange={(e) => setHuisadrplaats(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="huisadrtelnr">Telefoonnummer</Label>
                          <Input
                            id="huisadrtelnr"
                            type="text"
                            value={huisadrtelnr}
                            onChange={(e) => setHuisadrtelnr(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="huisadrfax">Faxnummer</Label>
                          <Input
                            id="huisadrfax"
                            type="text"
                            value={huisadrfax}
                            onChange={(e) => setHuisadrfax(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                  
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:gap-6">
                    <div className="flex min-w-0 flex-1 items-center gap-2 pt-0.5">
                      <Checkbox
                        id="smsdienstbegin"
                        checked={smsdienstbegin}
                        onCheckedChange={(c) => setSmsdienstbegin(!!c)}
                        disabled={isSubmitting}
                      />
                      <Label htmlFor="smsdienstbegin" className="cursor-pointer text-sm">
                        SMS begin dienst
                      </Label>
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2 pt-0.5">
                      <Checkbox
                        id="callRecording"
                        checked={callRecording}
                        onCheckedChange={(c) => setCallRecording(!!c)}
                        disabled={isSubmitting}
                      />
                      <Label htmlFor="callRecording" className="cursor-pointer text-sm">
                        Gespreksopname uit
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm dark:bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setWaarneemgroepenOpen((o) => !o)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40 aria-expanded:rounded-b-none"
                    aria-expanded={waarneemgroepenOpen}
                  >
                    {waarneemgroepenOpen ? (
                      <ChevronDown className="size-4 shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>FTE, rol en functie per waarneemgroep</span>
                      {totalWaarneemFte != null && (
                        <span className="text-xs font-normal text-muted-foreground">
                          Totaal FTE:{' '}
                          {totalWaarneemFte.toLocaleString('nl-NL', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )}
                    </span>
                  </button>
                  {waarneemgroepenOpen && (
                    <div className="space-y-2 border-t border-border/60 px-4 py-3">
                      {profile.waarneemgroepen.length === 0 ? (
                        <p className="text-sm text-muted-foreground">—</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {profile.waarneemgroepen.map((wg) => (
                            <div
                              key={wg.id}
                              className="flex flex-col gap-3 border-b border-border/60 py-2 last:border-0 last:pb-0 first:pt-0 sm:flex-row sm:items-end sm:gap-3"
                            >
                              <span className="min-w-0 flex-1 text-sm text-foreground">
                                {wg.naam ?? `Groep ${wg.id}`}
                              </span>
                              {wg.idgroep != null && (
                                <span
                                  className={`shrink-0 self-start rounded px-1.5 py-0.5 text-xs font-medium sm:self-center ${ROL_BADGE_CLASSES[wg.idgroep] ?? 'bg-muted text-foreground'}`}
                                >
                                  {ROL_LABELS[wg.idgroep] ?? `Rol ${wg.idgroep}`}
                                </span>
                              )}
                              <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-40">
                                <Label htmlFor={`functie-wg-${wg.id}`} className="text-xs text-muted-foreground">
                                  Functie
                                </Label>
                                <select
                                  id={`functie-wg-${wg.id}`}
                                  value={functieByWaarneemgroepId[wg.id] ?? ''}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const parsed = raw === '' ? null : Number(raw);
                                    setFunctieByWaarneemgroepId((prev) => ({
                                      ...prev,
                                      [wg.id]:
                                        parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4
                                          ? parsed
                                          : null,
                                    }));
                                  }}
                                  disabled={isSubmitting}
                                  className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
                                >
                                  <option value="">-- Kies functie --</option>
                                  {FUNCTIE_OPTIONS.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-32">
                                <Label htmlFor={`fte-wg-${wg.id}`} className="text-xs text-muted-foreground">
                                  FTE (0–1)
                                </Label>
                                <Input
                                  id={`fte-wg-${wg.id}`}
                                  type="text"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  value={
                                    fteDraftByWgId[wg.id] !== undefined
                                      ? fteDraftByWgId[wg.id]!
                                      : formatFteDisplay(fteByWaarneemgroepId[wg.id] ?? 1)
                                  }
                                  onChange={(e) => {
                                    const sanitized = sanitizeFteInputString(e.target.value);
                                    setFteDraftByWgId((d) => ({ ...d, [wg.id]: sanitized }));
                                    const n = parseFteInputToNumber(sanitized);
                                    if (n !== null) {
                                      setFteByWaarneemgroepId((prev) => ({
                                        ...prev,
                                        [wg.id]: Math.min(2, Math.max(0, n)),
                                      }));
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const raw = e.target.value;
                                    let n = parseFteInputToNumber(raw);
                                    if (n === null) {
                                      n = fteByWaarneemgroepId[wg.id] ?? 1;
                                    }
                                    const committed = commitFteNumber(n);
                                    setFteByWaarneemgroepId((prev) => ({
                                      ...prev,
                                      [wg.id]: committed,
                                    }));
                                    setFteDraftByWgId((d) => {
                                      const next = { ...d };
                                      delete next[wg.id];
                                      return next;
                                    });
                                  }}
                                  disabled={isSubmitting}
                                  className="h-9"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm dark:bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setExpertisesOpen((o) => !o)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40 aria-expanded:rounded-b-none"
                    aria-expanded={expertisesOpen}
                  >
                    {expertisesOpen ? (
                      <ChevronDown className="size-4 shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0" />
                    )}
                    <span>Expertises per waarneemgroep</span>
                  </button>
                  {expertisesOpen && (
                    <div className="space-y-2 border-t border-border/60 px-4 py-3">
                      {profile.waarneemgroepen.length === 0 ? (
                        <p className="text-sm text-muted-foreground">—</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {profile.waarneemgroepen.map((wg) => {
                            const selected = expertiseIdsByWaarneemgroepId[wg.id] ?? [];
                            const selectedSet = new Set(selected);
                            return (
                              <div
                                key={wg.id}
                                className="flex flex-col gap-2 border-b border-border/60 py-2 last:border-0 last:pb-0 first:pt-0"
                              >
                                <span className="text-sm text-foreground">
                                  {wg.naam ?? `Groep ${wg.id}`}
                                </span>
                                {(wg.expertises ?? []).length === 0 ? (
                                  <p className="text-sm text-muted-foreground">
                                    Geen expertises beschikbaar
                                  </p>
                                ) : (
                                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-2">
                                    {wg.expertises.map((exp) => {
                                      const checked = selectedSet.has(exp.id);
                                      const abbr = exp.afkorting?.trim();
                                      const label =
                                        abbr && abbr !== exp.naam
                                          ? `${exp.naam} (${abbr})`
                                          : exp.naam;
                                      return (
                                        <label
                                          key={exp.id}
                                          className="flex cursor-pointer items-center gap-2 text-sm"
                                        >
                                          <Checkbox
                                            checked={checked}
                                            disabled={isSubmitting}
                                            onCheckedChange={(next) => {
                                              setExpertiseIdsByWaarneemgroepId((prev) => {
                                                const current = prev[wg.id] ?? [];
                                                const nextIds = next
                                                  ? current.includes(exp.id)
                                                    ? current
                                                    : [...current, exp.id]
                                                  : current.filter((id) => id !== exp.id);
                                                return {
                                                  ...prev,
                                                  [wg.id]: nextIds.sort((a, b) => a - b),
                                                };
                                              });
                                            }}
                                          />
                                          <span>{label}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={formSectionClass}>
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm font-medium">Telefoonnummers</Label>
                    <p className="text-xs text-muted-foreground">
                      Minimaal 1, maximaal 5 nummers. Het laatste nummer is bij voorkeur een portier. Telefoonnummers worden gebeld in volgorde zoals hier opgegeven.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {telnrSlots.map((slot, i) => (
                      <div
                        key={i}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Telefoonnummer {i + 1}</span>
                          {telnrSlots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSlot(i)}
                              disabled={isSubmitting}
                              className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 disabled:opacity-50"
                            >
                              <Trash2 className="size-3" />
                              Verwijder
                            </button>
                          )}
                        </div>

                        {/* Number + SMS */}
                        <div className="flex flex-wrap gap-3 items-center">
                          <Input
                            type="tel"
                            value={slot.telnr}
                            onChange={(e) => updateSlot(i, { telnr: e.target.value })}
                            placeholder="Telefoonnummer"
                            className="w-48"
                            disabled={isSubmitting}
                          />
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={slot.smsontvanger}
                              onChange={(e) => updateSlot(i, { smsontvanger: e.target.checked })}
                              disabled={isSubmitting}
                              className="accent-primary"
                            />
                            Kan ook SMS ontvangen
                          </label>
                        </div>

                        {/* Location type + sub-location */}
                        <div className="flex flex-wrap gap-2 items-center">
                          <Label className="text-xs text-muted-foreground w-14 shrink-0">Locatie:</Label>
                          <select
                            value={slot.idInstellingtype}
                            onChange={(e) =>
                              updateSlot(i, {
                                idInstellingtype: Number(e.target.value),
                                idLocatie: null,
                                locatieSuffix: 'binnen',
                              })
                            }
                            className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
                            disabled={isSubmitting}
                          >
                            {[...TELNR_SPECIAL_TYPES, ...lookup.instellingtypen].map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.naam ?? `Type ${t.id}`}
                              </option>
                            ))}
                          </select>

                          {slot.idInstellingtype < 1000 && (
                            <select
                              key={`${slot.locatieSuffix}-${slot.idInstellingtype}-${i}`}
                              value={slot.idLocatie ?? ''}
                              onChange={(e) => handleSlotLocatieChange(i, Number(e.target.value))}
                              className="h-8 min-w-[145px] rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
                              disabled={isSubmitting}
                            >
                              {(slot.locatieSuffix === 'binnen'
                                ? lookup.locatiesPerTypeBinnen[slot.idInstellingtype]
                                : lookup.locatiesPerTypeBuiten[slot.idInstellingtype]
                              )?.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.naam}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Omschrijving */}
                        {lookup.omschrijvingtelnrs.length > 0 && (
                          <div className="flex flex-wrap gap-2 items-center">
                            <Label className="text-xs text-muted-foreground w-14 shrink-0">Omschr.:</Label>
                            <select
                              value={slot.idomschrtelnr}
                              onChange={(e) => updateSlot(i, { idomschrtelnr: Number(e.target.value) })}
                              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
                              disabled={isSubmitting}
                            >
                              {lookup.omschrijvingtelnrs.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.omschrijving}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {telnrSlots.length < 5 && (
                    <button
                      type="button"
                      onClick={addSlot}
                      disabled={isSubmitting}
                      className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      <Plus className="size-4" />
                      Telefoonnummer toevoegen
                    </button>
                  )}
                </div>

              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
