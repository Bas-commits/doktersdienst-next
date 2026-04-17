'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useMemo, useRef } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordChangeModal } from '@/components/mijn-gegevens/PasswordChangeModal';
import type { MijnGegevensProfile, MijnGegevensLookup, MijnGegevensUpdateBody, TelnrSlot } from '@/types/mijn-gegevens';

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

const ROL_LABELS: Record<number, string> = {
  1: 'Deelnemer',
  2: 'Secretaris',
  3: 'Receptionist',
  4: 'Kijker',
};

const ROL_BADGE_CLASSES: Record<number, string> = {
  1: 'bg-primary/10 text-primary',
  2: 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200',
  3: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  4: 'bg-muted text-muted-foreground',
};

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
};

function RequiredAsterisk() {
  return <span className="text-[#c91b23]">*</span>;
}

export default function MijnGegevensPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [profile, setProfile] = useState<MijnGegevensProfile | null>(null);
  const [lookup, setLookup] = useState<MijnGegevensLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<FormSnapshot | null>(null);
  const [pendingNavUrl, setPendingNavUrl] = useState<string | null>(null);
  const allowNavRef = useRef(false);

  // Form state – initialised from profile when loaded
  const [login, setLogin] = useState('');
  const [color, setColor] = useState('#cccccc');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [waarneemgroepenOpen, setWaarneemgroepenOpen] = useState(false);
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
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/mijn-gegevens', { credentials: 'include' })
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
        setProfile(profileRes);
        setLookup(lookupRes);
        setLogin(profileRes.deelnemer.login ?? '');
        setColor(profileRes.deelnemer.color ?? '#cccccc');
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
        setHuisemail(profileRes.deelnemer.huisemail ?? '');
        setEchtedeelnemer(profileRes.deelnemer.echtedeelnemer === true);
        setSmsdienstbegin(profileRes.deelnemer.smsdienstbegin === true);
        setCallRecording(profileRes.deelnemer.callRecording === true);
        const initialSlots = profileRes.telnrSlots.length > 0 ? profileRes.telnrSlots : [{ ...DEFAULT_SLOT }];
        setTelnrSlots(initialSlots);
        setSavedSnapshot({
          color: profileRes.deelnemer.color ?? '#cccccc',
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
          huisemail: profileRes.deelnemer.huisemail ?? '',
          echtedeelnemer: profileRes.deelnemer.echtedeelnemer === true,
          smsdienstbegin: profileRes.deelnemer.smsdienstbegin === true,
          callRecording: profileRes.deelnemer.callRecording === true,
          telnrSlots: initialSlots,
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
  }, [session?.user]);

  const showEchtedeelnemer = useMemo(() => {
    const id = profile?.groep?.id;
    return id === 2 || id === 3;
  }, [profile?.groep?.id]);

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
      JSON.stringify(telnrSlots) !== JSON.stringify(s.telnrSlots)
    );
  }, [savedSnapshot, color, achternaam, voorletterstussenvoegsel, voornaam, initialen, geslacht, idlocatie, huisadrstraatnr, huisadrpostcode, huisadrplaats, huisadrtelnr, huisadrfax, huisemail, echtedeelnemer, smsdienstbegin, callRecording, telnrSlots]);

  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      if (isDirty && !allowNavRef.current) {
        setPendingNavUrl(url);
        router.events.emit('routeChangeError');
        throw 'routeChange aborted.';
      }
      allowNavRef.current = false;
    };
    router.events.on('routeChangeStart', handleRouteChangeStart);
    return () => router.events.off('routeChangeStart', handleRouteChangeStart);
  }, [isDirty, router.events]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

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
    const body: MijnGegevensUpdateBody = {
      color,
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
      huisemail: huisemail.trim() || undefined,
      echtedeelnemer: showEchtedeelnemer ? echtedeelnemer : undefined,
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
    };

    const res = await fetch('/api/mijn-gegevens', {
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

    if (data.loginUpdated) {
      setLogin(huisemail.trim());
      toast.success('Gegevens opgeslagen. Uw loginnaam is bijgewerkt naar uw e-mailadres.');
    } else {
      toast.success('Gegevens opgeslagen.');
    }

    setSavedSnapshot({ color, achternaam, voorletterstussenvoegsel, voornaam, initialen, geslacht, idlocatie, huisadrstraatnr, huisadrpostcode, huisadrplaats, huisadrtelnr, huisadrfax, huisemail, echtedeelnemer, smsdienstbegin, callRecording, telnrSlots });
    return true;
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    await doSave();
  }

  async function handleSaveAndLeave() {
    const ok = await doSave();
    if (ok && pendingNavUrl) {
      const url = pendingNavUrl;
      setPendingNavUrl(null);
      allowNavRef.current = true;
      router.push(url);
    }
  }

  function handleLeaveWithoutSaving() {
    if (!pendingNavUrl) return;
    const url = pendingNavUrl;
    setPendingNavUrl(null);
    allowNavRef.current = true;
    router.push(url);
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
      />
      {pendingNavUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold tracking-tight">Niet-opgeslagen wijzigingen</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              U heeft niet-opgeslagen wijzigingen. Wilt u deze opslaan voordat u verder gaat?
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingNavUrl(null)}
                disabled={isSubmitting}
              >
                Annuleren
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleLeaveWithoutSaving}
                disabled={isSubmitting}
              >
                Verlaten
              </Button>
              <Button
                type="button"
                onClick={handleSaveAndLeave}
                disabled={isSubmitting}
                className="font-bold text-white"
                style={{
                  background: 'linear-gradient(90deg, rgb(79, 27, 153) 0%, rgb(45, 34, 69) 100%)',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'linear-gradient(90deg, rgb(56, 19, 108) 0%, rgb(45, 34, 69) 100%)';
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'linear-gradient(90deg, rgb(79, 27, 153) 0%, rgb(45, 34, 69) 100%)';
                }}
              >
                {isSubmitting ? 'Opslaan…' : 'Opslaan en verlaten'}
              </Button>
            </div>
          </div>
        </div>
      )}
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
                    Waarneemgroepen
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
                              className="flex flex-col gap-1 border-b border-border/60 py-2 last:border-0 last:pb-0 first:pt-0 sm:flex-row sm:items-center sm:gap-3"
                            >
                              <span className="min-w-0 flex-1 text-sm text-foreground">
                                {wg.naam ?? `Groep ${wg.id}`}
                              </span>
                              {wg.idgroep != null && (
                                <span
                                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${ROL_BADGE_CLASSES[wg.idgroep] ?? 'bg-muted text-foreground'}`}
                                >
                                  {ROL_LABELS[wg.idgroep] ?? `Rol ${wg.idgroep}`}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={formSectionClass}>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Label htmlFor="huisemail">E-mail <RequiredAsterisk /></Label>
                      <Input
                        id="huisemail"
                        type="email"
                        value={huisemail}
                        onChange={(e) => setHuisemail(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Label htmlFor="login" className="text-muted-foreground">
                        Loginnaam
                      </Label>
                      <Input
                        id="login"
                        type="text"
                        value={login}
                        autoComplete="username"
                        disabled
                        className="text-muted-foreground"
                      />
                      {login !== huisemail && login !== '' && (
                        <p className="text-xs text-muted-foreground">
                          Uw loginnaam verschilt van uw e-mailadres en wordt automatisch bijgewerkt bij het opslaan.
                        </p>
                      )}
                    </div>
                  </div>
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
                  </div>
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
                          style={{ backgroundColor: color || '#cccccc' }}
                        />
                        <input
                          ref={colorInputRef}
                          type="color"
                          className="sr-only"
                          value={color || '#cccccc'}
                          onChange={(e) => setColor(e.target.value)}
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
                      <Label htmlFor="voorletterstussenvoegsel">Tussenvoegsel <RequiredAsterisk /></Label>
                      <Input
                        id="voorletterstussenvoegsel"
                        type="text"
                        value={voorletterstussenvoegsel}
                        onChange={(e) => setVoorletterstussenvoegsel(e.target.value)}
                        required
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
                    {showEchtedeelnemer && (
                      <div className="flex min-w-0 flex-1 items-center gap-2 pt-0.5">
                        <Checkbox
                          id="echtedeelnemer"
                          checked={echtedeelnemer}
                          onCheckedChange={(c) => setEchtedeelnemer(!!c)}
                          disabled={isSubmitting}
                        />
                        <Label htmlFor="echtedeelnemer" className="cursor-pointer text-sm">
                          Voor secretaris - Wordt wel ingeroosterd
                        </Label>
                      </div>
                    )}
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
