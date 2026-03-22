'use client';

import Head from 'next/head';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { WaarneemgroepGegevens } from './api/waarneemgroep-gegevens';

export default function WaarneemgroepGegevensPage() {
  const { data: session, isPending } = authClient.useSession();
  const { activeWaarneemgroepId } = useWaarneemgroep();

  const [gegevens, setGegevens] = useState<WaarneemgroepGegevens | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [naam, setNaam] = useState('');
  const [regiobeschrijving, setRegiobeschrijving] = useState('');
  const [telnringaand, setTelnringaand] = useState('');
  const [telnrnietopgenomen, setTelnrnietopgenomen] = useState('');
  const [smsdienstbegin, setSmsdienstbegin] = useState(false);
  const [gebruiktVoicemail, setGebruiktVoicemail] = useState(false);
  const [eigentelwelkomwav, setEigentelwelkomwav] = useState(false);
  const [abomaatschapplanner, setAbomaatschapplanner] = useState(false);

  useEffect(() => {
    if (!session?.user || !activeWaarneemgroepId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/waarneemgroep-gegevens?id=${activeWaarneemgroepId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        const wg: WaarneemgroepGegevens = data.waarneemgroep;
        setGegevens(wg);
        setNaam(wg.naam ?? '');
        setRegiobeschrijving(wg.regiobeschrijving ?? '');
        setTelnringaand(wg.telnringaand ?? '');
        setTelnrnietopgenomen(wg.telnrnietopgenomen ?? '');
        setSmsdienstbegin(wg.smsdienstbegin === true);
        setGebruiktVoicemail(wg.gebruiktVoicemail === true);
        setEigentelwelkomwav(wg.eigentelwelkomwav === true);
        setAbomaatschapplanner(wg.abomaatschapplanner === true);
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
  }, [session?.user, activeWaarneemgroepId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWaarneemgroepId) return;
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsSubmitting(true);

    const res = await fetch(`/api/waarneemgroep-gegevens?id=${activeWaarneemgroepId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        naam: naam.trim() || undefined,
        regiobeschrijving: regiobeschrijving.trim() || undefined,
        telnringaand: telnringaand.trim() || undefined,
        telnrnietopgenomen: telnrnietopgenomen.trim() || undefined,
        smsdienstbegin,
        gebruiktVoicemail,
        eigentelwelkomwav,
        abomaatschapplanner,
      }),
    });
    const data = await res.json();
    setIsSubmitting(false);
    if (!res.ok) {
      setSubmitError(data.error ?? 'Opslaan mislukt');
      return;
    }
    setSubmitSuccess(true);
  }

  if (isPending || !session?.user) return null;

  return (
    <>
      <Head>
        <title>Waarneemgroep gegevens | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl font-semibold tracking-tight">Gegevens waarneemgroep</h1>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!activeWaarneemgroepId && (
              <p className="text-muted-foreground">Geen waarneemgroep geselecteerd.</p>
            )}
            {activeWaarneemgroepId && loading && !gegevens && (
              <p className="text-muted-foreground">Gegevens laden…</p>
            )}
            {activeWaarneemgroepId && error && !gegevens && (
              <p className="text-destructive" role="alert">{error}</p>
            )}
            {activeWaarneemgroepId && gegevens && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {submitError && (
                  <p className="text-sm text-destructive" role="alert">{submitError}</p>
                )}
                {submitSuccess && (
                  <p className="text-sm text-green-600 dark:text-green-400" role="status">Gegevens opgeslagen.</p>
                )}

                <div className="flex gap-4">
                  <div className="flex flex-col gap-1 w-16 shrink-0">
                    <Label>ID</Label>
                    <p className="text-sm text-muted-foreground pt-1">{gegevens.id}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <Label htmlFor="naam">Naam</Label>
                    <Input
                      id="naam"
                      type="text"
                      value={naam}
                      onChange={(e) => setNaam(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="regiobeschrijving">Regio beschrijving</Label>
                  <Input
                    id="regiobeschrijving"
                    type="text"
                    value={regiobeschrijving}
                    onChange={(e) => setRegiobeschrijving(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="telnringaand">Telefoonnummer doorgerouteerd naar diensdoende</Label>
                  <Input
                    id="telnringaand"
                    type="text"
                    placeholder="31880026477"
                    value={telnringaand}
                    onChange={(e) => setTelnringaand(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="telnrnietopgenomen">Telefoonnummer achtervang</Label>
                  <Input
                    id="telnrnietopgenomen"
                    type="text"
                    placeholder="31880026477"
                    value={telnrnietopgenomen}
                    onChange={(e) => setTelnrnietopgenomen(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {gegevens.telnronzecentrale && (
                  <div className="flex flex-col gap-1">
                    <Label>Telnr onze centrale</Label>
                    <p className="text-sm text-muted-foreground">{gegevens.telnronzecentrale}</p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label>Notificaties</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="smsdienstbegin"
                      checked={smsdienstbegin}
                      onCheckedChange={(c) => setSmsdienstbegin(!!c)}
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="smsdienstbegin" className="cursor-pointer text-sm font-normal">SMS begin dienst</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="gebruiktVoicemail"
                      checked={gebruiktVoicemail}
                      onCheckedChange={(c) => setGebruiktVoicemail(!!c)}
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="gebruiktVoicemail" className="cursor-pointer text-sm font-normal">Gebruikt voicemail</Label>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Welkomsboodschap</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="eigentelwelkomwav"
                      checked={eigentelwelkomwav}
                      onCheckedChange={(c) => setEigentelwelkomwav(!!c)}
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="eigentelwelkomwav" className="cursor-pointer text-sm font-normal">Eigen welkomsboodschap</Label>
                  </div>
                </div>

                <div className="border-t pt-4 flex flex-col gap-2">
                  <h2 className="text-lg font-semibold">Abonnementen</h2>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="abomaatschapplanner"
                      checked={abomaatschapplanner}
                      onCheckedChange={(c) => setAbomaatschapplanner(!!c)}
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="abomaatschapplanner" className="cursor-pointer text-sm font-normal">Maatschappij planner</Label>
                  </div>
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
