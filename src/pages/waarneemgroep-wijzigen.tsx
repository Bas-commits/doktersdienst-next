'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { WaarneemgroepWijzigenOptions } from './api/waarneemgroep-wijzigen/index';
import type { WaarneemgroepDetail, DeelnemerItem, WaarneemgroepWijzigenShowResponse } from './api/waarneemgroep-wijzigen/[id]';

function deelnemerLabel(d: DeelnemerItem): string {
  const tussen = d.voorletterstussenvoegsel ? ` ${d.voorletterstussenvoegsel} ` : ' ';
  return `${d.voornaam ?? ''},${tussen}${d.achternaam ?? ''}`;
}

function toFormId(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '';
}

type FormData = {
  naam: string;
  idspecialisme: string;
  idregio: string;
  idinstelling: string;
  regiobeschrijving: string;
  telnringaand: string;
  telnrnietopgenomen: string;
  idinvoegendewaarneemgroep: string;
  telnronzecentrale: string;
  telnrconference: string;
  afgemeld: boolean;
  smsdienstbegin: boolean;
  eigentelwelkomwav: boolean;
  gebruiktVoicemail: boolean;
  abomaatschapplanner: boolean;
  idcoordinatorwaarneemgroep: string;
  idliason1: string;
  idliason2: string;
  idliason3: string;
  idliason4: string;
};

function wgToForm(wg: WaarneemgroepDetail): FormData {
  return {
    naam: wg.naam ?? '',
    idspecialisme: toFormId(wg.idspecialisme),
    idregio: toFormId(wg.idregio),
    idinstelling: toFormId(wg.idinstelling),
    regiobeschrijving: wg.regiobeschrijving ?? '',
    telnringaand: wg.telnringaand ?? '',
    telnrnietopgenomen: wg.telnrnietopgenomen ?? '',
    idinvoegendewaarneemgroep: toFormId(wg.idinvoegendewaarneemgroep) || '0',
    telnronzecentrale: wg.telnronzecentrale ?? '',
    telnrconference: wg.telnrconference ?? '',
    afgemeld: wg.afgemeld === true,
    smsdienstbegin: wg.smsdienstbegin === true,
    eigentelwelkomwav: wg.eigentelwelkomwav === true,
    gebruiktVoicemail: wg.gebruiktVoicemail === true,
    abomaatschapplanner: wg.abomaatschapplanner === true,
    idcoordinatorwaarneemgroep: toFormId(wg.idcoordinatorwaarneemgroep),
    idliason1: toFormId(wg.idliason1) || '0',
    idliason2: toFormId(wg.idliason2) || '0',
    idliason3: toFormId(wg.idliason3) || '0',
    idliason4: toFormId(wg.idliason4) || '0',
  };
}

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50';

export default function WaarneemgroepWijzigenPage() {
  const { data: session, isPending } = authClient.useSession();

  const [options, setOptions] = useState<WaarneemgroepWijzigenOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedWg, setSelectedWg] = useState<WaarneemgroepDetail | null>(null);
  const [selectedDeelnemers, setSelectedDeelnemers] = useState<DeelnemerItem[]>([]);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/waarneemgroep-wijzigen', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setOptionsError(data.error); return; }
        setOptions(data);
      })
      .catch((err) => setOptionsError(err instanceof Error ? err.message : 'Laden mislukt'))
      .finally(() => setOptionsLoading(false));
  }, [session?.user]);

  const loadSelected = (id: number) => {
    setSelectedId(id);
    setSelectedWg(null);
    setFormData(null);
    setSelectedError(null);
    setSubmitSuccess(false);
    setSubmitError(null);
    setSelectedLoading(true);
    fetch(`/api/waarneemgroep-wijzigen/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: WaarneemgroepWijzigenShowResponse & { error?: string }) => {
        if (data.error) { setSelectedError(data.error); return; }
        setSelectedWg(data.waarneemgroep);
        setSelectedDeelnemers(data.deelnemers ?? []);
        setFormData(wgToForm(data.waarneemgroep));
      })
      .catch((err) => setSelectedError(err instanceof Error ? err.message : 'Laden mislukt'))
      .finally(() => setSelectedLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !formData) return;
    setSubmitError(null);
    setSubmitSuccess(false);
    setSubmitting(true);

    const toNum = (v: string): number | null => {
      if (!v || v === '0') return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const body = {
      naam: formData.naam.trim() || undefined,
      idspecialisme: toNum(formData.idspecialisme),
      idregio: toNum(formData.idregio),
      idinstelling: toNum(formData.idinstelling),
      regiobeschrijving: formData.regiobeschrijving.trim() || null,
      telnringaand: formData.telnringaand.trim() || null,
      telnrnietopgenomen: formData.telnrnietopgenomen.trim() || null,
      idinvoegendewaarneemgroep: toNum(formData.idinvoegendewaarneemgroep),
      telnronzecentrale: formData.telnronzecentrale.trim() || null,
      telnrconference: formData.telnrconference.trim() || null,
      afgemeld: formData.afgemeld,
      smsdienstbegin: formData.smsdienstbegin,
      eigentelwelkomwav: formData.eigentelwelkomwav,
      gebruiktVoicemail: formData.gebruiktVoicemail,
      abomaatschapplanner: formData.abomaatschapplanner,
      idcoordinatorwaarneemgroep: toNum(formData.idcoordinatorwaarneemgroep),
      idliason1: toNum(formData.idliason1),
      idliason2: toNum(formData.idliason2),
      idliason3: toNum(formData.idliason3),
      idliason4: toNum(formData.idliason4),
    };

    try {
      const res = await fetch(`/api/waarneemgroep-wijzigen/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? 'Opslaan mislukt'); return; }
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Opslaan mislukt');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key: keyof FormData, value: string | boolean) =>
    setFormData((f) => f ? { ...f, [key]: value } : f);

  if (isPending || !session?.user) return null;

  return (
    <>
      <Head>
        <title>Waarneemgroep wijzigen | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Waarneemgroep wijzigen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kies een waarneemgroep in de tabel en pas de gegevens aan.
          </p>
        </div>

        {optionsLoading && <p className="text-sm text-muted-foreground">Laden…</p>}
        {optionsError && <p className="text-sm text-destructive" role="alert">{optionsError}</p>}

        {options && (
          <>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pt-3 px-4 font-medium w-16">ID</th>
                    <th className="pb-2 pt-3 px-4 font-medium">Naam</th>
                    <th className="pb-2 pt-3 px-4 font-medium w-28" />
                  </tr>
                </thead>
                <tbody>
                  {options.waarneemgroepen.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-muted-foreground">
                        Geen waarneemgroepen gevonden.
                      </td>
                    </tr>
                  ) : (
                    options.waarneemgroepen.map((wg) => (
                      <tr
                        key={wg.id}
                        className={`border-b last:border-0 hover:bg-muted/50 ${selectedId === wg.id ? 'bg-muted/50' : ''}`}
                      >
                        <td className="px-4 py-2.5 text-muted-foreground">{wg.id}</td>
                        <td className="px-4 py-2.5 font-medium">{wg.naam}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => loadSelected(wg.id)}
                            aria-label={`Waarneemgroep ${wg.naam} bewerken`}
                          >
                            Bewerken
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {selectedLoading && (
              <p className="text-sm text-muted-foreground">Gegevens laden…</p>
            )}
            {selectedError && (
              <p className="text-sm text-destructive" role="alert">{selectedError}</p>
            )}

            {selectedWg && formData && !selectedLoading && (
              <Card>
                <CardHeader>
                  <CardTitle>Gegevens: {selectedWg.naam}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {submitError && (
                      <p className="text-sm text-destructive" role="alert">{submitError}</p>
                    )}
                    {submitSuccess && (
                      <p className="text-sm text-green-600 dark:text-green-400" role="status">
                        Waarneemgroep opgeslagen.
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="wg-naam">Naam</Label>
                        <Input
                          id="wg-naam"
                          value={formData.naam}
                          onChange={(e) => set('naam', e.target.value)}
                          disabled={submitting}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="wg-specialisme">Specialisme</Label>
                        <select
                          id="wg-specialisme"
                          className={selectClass}
                          value={formData.idspecialisme}
                          onChange={(e) => set('idspecialisme', e.target.value)}
                          disabled={submitting}
                        >
                          <option value="">— Kies specialisme —</option>
                          {options.specialismen.map((s) => (
                            <option key={s.id} value={String(s.id)}>{s.omschrijving}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="wg-regio">Regio</Label>
                        <select
                          id="wg-regio"
                          className={selectClass}
                          value={formData.idregio}
                          onChange={(e) => set('idregio', e.target.value)}
                          disabled={submitting}
                        >
                          <option value="">— Kies regio —</option>
                          {options.regios.map((r) => (
                            <option key={r.id} value={String(r.id)}>{r.naam}</option>
                          ))}
                        </select>
                      </div>
                      {options.instellingen.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="wg-instelling">Instelling</Label>
                          <select
                            id="wg-instelling"
                            className={selectClass}
                            value={formData.idinstelling}
                            onChange={(e) => set('idinstelling', e.target.value)}
                            disabled={submitting}
                          >
                            <option value="">— Kies instelling —</option>
                            {options.instellingen.map((i) => (
                              <option key={i.id} value={String(i.id)}>{i.naam}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label htmlFor="wg-regiobeschrijving">Regio beschrijving</Label>
                      <textarea
                        id="wg-regiobeschrijving"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.regiobeschrijving}
                        onChange={(e) => set('regiobeschrijving', e.target.value)}
                        disabled={submitting}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="wg-telnringaand">Telefoonnummer doorgerouteerd naar diensdoende</Label>
                        <Input
                          id="wg-telnringaand"
                          value={formData.telnringaand}
                          onChange={(e) => set('telnringaand', e.target.value)}
                          disabled={submitting}
                          placeholder="31880026477"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="wg-telnrnietopgenomen">Telefoonnummer achtervang</Label>
                        <Input
                          id="wg-telnrnietopgenomen"
                          value={formData.telnrnietopgenomen}
                          onChange={(e) => set('telnrnietopgenomen', e.target.value)}
                          disabled={submitting}
                          placeholder="31880026477"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label htmlFor="wg-invoegende">Bij gat in rooster naar waarneemgroep</Label>
                      <select
                        id="wg-invoegende"
                        className={selectClass}
                        value={formData.idinvoegendewaarneemgroep}
                        onChange={(e) => set('idinvoegendewaarneemgroep', e.target.value)}
                        disabled={submitting}
                      >
                        <option value="0">Geen</option>
                        {options.waarneemgroepenForInvoegende
                          .filter((w) => w.id !== selectedId)
                          .map((w) => (
                            <option key={w.id} value={String(w.id)}>{w.naam}</option>
                          ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="wg-telnronzecentrale">Telnr onze centrale</Label>
                        <Input
                          id="wg-telnronzecentrale"
                          value={formData.telnronzecentrale}
                          onChange={(e) => set('telnronzecentrale', e.target.value)}
                          disabled={submitting}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="wg-telnrconference">Telnr conference</Label>
                        <Input
                          id="wg-telnrconference"
                          value={formData.telnrconference}
                          onChange={(e) => set('telnrconference', e.target.value)}
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                      {(
                        [
                          ['afgemeld', 'Afgemeld'],
                          ['smsdienstbegin', 'SMS begin dienst'],
                          ['eigentelwelkomwav', 'Eigen welkomstboodschap'],
                          ['gebruiktVoicemail', 'Gebruikt voicemail'],
                          ['abomaatschapplanner', 'Praktijkplanner abonnement'],
                        ] as [keyof FormData, string][]
                      ).map(([key, label]) => (
                        <div key={key} className="flex items-center gap-2">
                          <Checkbox
                            id={`wg-${key}`}
                            checked={formData[key] as boolean}
                            onCheckedChange={(c) => set(key, !!c)}
                            disabled={submitting}
                          />
                          <Label htmlFor={`wg-${key}`} className="cursor-pointer font-normal">{label}</Label>
                        </div>
                      ))}
                    </div>

                    

                    <div>
                      <Button type="submit" disabled={submitting}>
                        {submitting ? 'Opslaan…' : 'Opslaan'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
