'use client';

import Head from 'next/head';
import { useEffect, useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordChangeModal } from '@/components/mijn-gegevens/PasswordChangeModal';
import type { MijnGegevensProfile, MijnGegevensLookup, MijnGegevensUpdateBody } from '@/types/mijn-gegevens';

export default function MijnGegevensPage() {
  const { data: session, isPending } = authClient.useSession();
  const [profile, setProfile] = useState<MijnGegevensProfile | null>(null);
  const [lookup, setLookup] = useState<MijnGegevensLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state – initialised from profile when loaded
  const [login, setLogin] = useState('');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [achternaam, setAchternaam] = useState('');
  const [voorletterstussenvoegsel, setVoorletterstussenvoegsel] = useState('');
  const [voornaam, setVoornaam] = useState('');
  const [initialen, setInitialen] = useState('');
  const [geslacht, setGeslacht] = useState<0 | 1>(0);
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
        setAchternaam(profileRes.deelnemer.achternaam ?? '');
        setVoorletterstussenvoegsel(profileRes.deelnemer.voorletterstussenvoegsel ?? '');
        setVoornaam(profileRes.deelnemer.voornaam ?? '');
        setInitialen(profileRes.deelnemer.initialen ?? '');
        setGeslacht(profileRes.deelnemer.geslacht === true ? 1 : 0);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsSubmitting(true);

    const body: MijnGegevensUpdateBody = {
      login: login.trim() || undefined,
      achternaam: achternaam.trim() || undefined,
      voorletterstussenvoegsel: voorletterstussenvoegsel.trim() || undefined,
      voornaam: voornaam.trim() || undefined,
      initialen: initialen.trim() || undefined,
      geslacht,
      idlocatie: idlocatie !== -1 ? idlocatie : undefined,
      huisadrstraatnr: huisadrstraatnr.trim() || undefined,
      huisadrpostcode: huisadrpostcode.trim() || undefined,
      huisadrplaats: huisadrplaats.trim() || undefined,
      huisadrtelnr: huisadrtelnr.trim() || undefined,
      huisadrfax: huisadrfax.trim() || undefined,
      huisemail: huisemail.trim() || undefined,
      echtedeelnemer: showEchtedeelnemer ? echtedeelnemer : undefined,
      smsdienstbegin,
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
      setSubmitError(data.error ?? 'Opslaan mislukt');
      return;
    }
    setSubmitSuccess(true);
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
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl font-semibold tracking-tight">
                {submitSuccess ? 'Gegevens gewijzigd' : 'Mijn gegevens wijzigen'}
              </h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !profile && (
              <p className="text-muted-foreground">Gegevens laden…</p>
            )}
            {error && !profile && (
              <p className="text-destructive" role="alert">
                {error}
              </p>
            )}
            {profile && lookup && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                {submitError && (
                  <p className="text-sm text-destructive" role="alert">
                    {submitError}
                  </p>
                )}
                {submitSuccess && (
                  <p className="text-sm text-green-600 dark:text-green-400" role="status">
                    Uw gegevens zijn opgeslagen.
                  </p>
                )}

                <div className="flex flex-col gap-1">
                  <Label>Waarneemgroep</Label>
                  <p className="text-sm text-muted-foreground">
                    {profile.waarneemgroep?.naam ?? '—'}
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="login">Loginnaam *</Label>
                  <Input
                    id="login"
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    required
                    autoComplete="username"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="huisemail">E-mail *</Label>
                  <Input
                    id="huisemail"
                    type="email"
                    value={huisemail}
                    onChange={(e) => setHuisemail(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label>Wachtwoord</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPasswordModalOpen(true)}
                    disabled={isSubmitting}
                  >
                    Wijzig wachtwoord
                  </Button>
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="achternaam">Achternaam *</Label>
                  <Input
                    id="achternaam"
                    type="text"
                    value={achternaam}
                    onChange={(e) => setAchternaam(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="voorletterstussenvoegsel">Voorletters en tussenvoegsel(s) *</Label>
                  <Input
                    id="voorletterstussenvoegsel"
                    type="text"
                    value={voorletterstussenvoegsel}
                    onChange={(e) => setVoorletterstussenvoegsel(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="voornaam">Voornaam *</Label>
                  <Input
                    id="voornaam"
                    type="text"
                    value={voornaam}
                    onChange={(e) => setVoornaam(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="initialen">Initialen *</Label>
                  <Input
                    id="initialen"
                    type="text"
                    value={initialen}
                    onChange={(e) => setInitialen(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label>Geslacht *</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="geslacht"
                        checked={geslacht === 0}
                        onChange={() => setGeslacht(0)}
                        disabled={isSubmitting}
                      />
                      man
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="geslacht"
                        checked={geslacht === 1}
                        onChange={() => setGeslacht(1)}
                        disabled={isSubmitting}
                      />
                      vrouw
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="locatieType">Locatie (waar u het meest werkt)</Label>
                  <div className="flex flex-wrap items-center gap-2">
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
                </div>

                <div className="border border-border rounded-lg">
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

                {showEchtedeelnemer && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <Checkbox
                      id="echtedeelnemer"
                      checked={echtedeelnemer}
                      onCheckedChange={(c) => setEchtedeelnemer(!!c)}
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="echtedeelnemer" className="cursor-pointer text-sm">
                      Voor secretaris / receptionist – Wordt wel ingeroosterd
                    </Label>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-0.5">
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

                <CardFooter className="px-0 pb-0 pt-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Opslaan…' : 'Opslaan'}
                  </Button>
                </CardFooter>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
