'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { WaarneemgroepToevoegenOptions, WaarneemgroepTableItem } from './api/waarneemgroep-toevoegen/index';

/** Telefoonnummer: 08800264XX of 318800264XX (laatste twee cijfers variabel) */
const TELNR_REGEX = /^(08800264[0-9]{2}|318800264[0-9]{2})$/;

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
  smsdienstbegin: boolean;
  eigentelwelkomwav: boolean;
  gebruiktVoicemail: boolean;
  abomaatschapplanner: boolean;
};

const EMPTY_FORM: FormData = {
  naam: '',
  idspecialisme: '',
  idregio: '',
  idinstelling: '',
  regiobeschrijving: '',
  telnringaand: '',
  telnrnietopgenomen: '',
  idinvoegendewaarneemgroep: '0',
  telnronzecentrale: '',
  telnrconference: '',
  smsdienstbegin: false,
  eigentelwelkomwav: false,
  gebruiktVoicemail: false,
  abomaatschapplanner: false,
};

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50';

function refreshOptions(
  setOptions: (o: WaarneemgroepToevoegenOptions) => void
) {
  fetch('/api/waarneemgroep-toevoegen', { credentials: 'include' })
    .then((r) => r.json())
    .then((d: WaarneemgroepToevoegenOptions & { error?: string }) => {
      if (!d.error) setOptions(d);
    })
    .catch(() => {});
}

export default function WaarneemgroepToevoegenPage() {
  const { data: session, isPending } = authClient.useSession();

  const [options, setOptions] = useState<WaarneemgroepToevoegenOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [telnringaandError, setTelnringaandError] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<WaarneemgroepTableItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/waarneemgroep-toevoegen', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: WaarneemgroepToevoegenOptions & { error?: string }) => {
        if (data.error) { setOptionsError(data.error); return; }
        setOptions(data);
      })
      .catch((err) => setOptionsError(err instanceof Error ? err.message : 'Laden mislukt'))
      .finally(() => setOptionsLoading(false));
  }, [session?.user]);

  const set = (key: keyof FormData, value: string | boolean) =>
    setFormData((f) => ({ ...f, [key]: value }));

  const takenTelnrs = options?.waarneemgroepenTable
    .map((wg) => wg.telnringaand)
    .filter((t): t is string => t != null) ?? [];

  const validateTelnr = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!TELNR_REGEX.test(trimmed)) {
      return 'Formaat: 08800264XX of 318800264XX (laatste twee cijfers variabel).';
    }
    if (takenTelnrs.includes(trimmed)) {
      return `Telefoonnummer ${trimmed} is al in gebruik door een andere waarneemgroep.`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.naam.trim()) {
      toast.error('Naam is verplicht.');
      return;
    }

    const telnrErr = validateTelnr(formData.telnringaand);
    if (telnrErr) {
      setTelnringaandError(telnrErr);
      return;
    }

    const toNum = (v: string): number | null => {
      if (!v || v === '0') return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    setSubmitting(true);
    try {
      const body = {
        naam: formData.naam.trim(),
        idspecialisme: toNum(formData.idspecialisme),
        idregio: toNum(formData.idregio),
        idinstelling: toNum(formData.idinstelling),
        regiobeschrijving: formData.regiobeschrijving.trim() || null,
        telnringaand: formData.telnringaand.trim() || null,
        telnrnietopgenomen: formData.telnrnietopgenomen.trim() || null,
        idinvoegendewaarneemgroep: toNum(formData.idinvoegendewaarneemgroep),
        telnronzecentrale: formData.telnronzecentrale.trim() || null,
        telnrconference: formData.telnrconference.trim() || null,
        smsdienstbegin: formData.smsdienstbegin,
        eigentelwelkomwav: formData.eigentelwelkomwav,
        gebruiktVoicemail: formData.gebruiktVoicemail,
        abomaatschapplanner: formData.abomaatschapplanner,
      };

      const res = await fetch('/api/waarneemgroep-toevoegen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Opslaan mislukt.');
        return;
      }

      toast.success(`Waarneemgroep "${formData.naam.trim()}" aangemaakt (ID: ${data.id}).`);
      setFormData(EMPTY_FORM);
      setTelnringaandError(null);
      refreshOptions(setOptions);
    } catch {
      toast.error('Opslaan mislukt. Probeer het opnieuw.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/waarneemgroep-toevoegen/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Verwijderen mislukt.');
        return;
      }
      toast.success(`Waarneemgroep "${deleteTarget.naam}" verwijderd.`);
      setDeleteTarget(null);
      refreshOptions(setOptions);
    } catch {
      toast.error('Verwijderen mislukt. Probeer het opnieuw.');
    } finally {
      setDeleting(false);
    }
  };

  if (isPending || !session?.user) return null;

  return (
    <>
      <Head>
        <title>Waarneemgroep toevoegen | Doktersdienst</title>
      </Head>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { if (!deleting) setDeleteTarget(null); }}
        >
          <div
            className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold">Waarneemgroep verwijderen</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Weet u zeker dat u <span className="font-medium text-foreground">{deleteTarget.naam}</span> wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Annuleren
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Bezig…' : 'Verwijderen'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Waarneemgroep toevoegen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Maak een nieuwe waarneemgroep aan.
          </p>
        </div>

        {optionsLoading && <p className="text-sm text-muted-foreground">Laden…</p>}
        {optionsError && <p className="text-sm text-destructive" role="alert">{optionsError}</p>}

        {!optionsLoading && !optionsError && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Gegevens nieuwe waarneemgroep</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="wg-naam">
                      Naam <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="wg-naam"
                      value={formData.naam}
                      onChange={(e) => set('naam', e.target.value)}
                      disabled={submitting}
                      placeholder="Naam waarneemgroep"
                      maxLength={50}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        {options?.specialismen.map((s) => (
                          <option key={s.id} value={String(s.id)}>{s.omschrijving}</option>
                        ))}
                      </select>
                    </div>
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
                        {options?.regios.map((r) => (
                          <option key={r.id} value={String(r.id)}>{r.naam}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {options && options.instellingen.length > 0 && (
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
                        onChange={(e) => {
                          set('telnringaand', e.target.value);
                          if (telnringaandError) setTelnringaandError(null);
                        }}
                        onBlur={() => setTelnringaandError(validateTelnr(formData.telnringaand))}
                        disabled={submitting}
                        placeholder="bijv. 0880026400 of 31880026499"
                        aria-invalid={Boolean(telnringaandError)}
                      />
                      {telnringaandError ? (
                        <p className="text-xs text-destructive" role="alert">{telnringaandError}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Optioneel. Formaat: 08800264XX of 318800264XX. Moet uniek zijn.
                        </p>
                      )}
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
                      {options?.waarneemgroepen.map((w) => (
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

                  <div className="pt-2">
                    <Button type="submit" disabled={submitting || !formData.naam.trim()}>
                      {submitting ? 'Opslaan…' : 'Aanmaken'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Existing waarneemgroepen table */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Huidige waarneemgroepen</h2>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pt-3 px-4 font-medium w-14">ID</th>
                      <th className="pb-2 pt-3 px-4 font-medium">Naam</th>
                      <th className="pb-2 pt-3 px-4 font-medium">Specialisme</th>
                      <th className="pb-2 pt-3 px-4 font-medium">Regio</th>
                      <th className="pb-2 pt-3 px-4 font-medium">Telefoonnummer doorgerouteerd</th>
                      <th className="pb-2 pt-3 px-4 font-medium">Facturering</th>
                      <th className="pb-2 pt-3 px-4 font-medium w-32" />
                    </tr>
                  </thead>
                  <tbody>
                    {options.waarneemgroepenTable.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 text-muted-foreground">
                          Geen waarneemgroepen gevonden.
                        </td>
                      </tr>
                    ) : (
                      options.waarneemgroepenTable.map((wg) => (
                        <tr key={wg.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="px-4 py-2.5 text-muted-foreground">{wg.id}</td>
                          <td className="px-4 py-2.5 font-medium">{wg.naam}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{wg.specialisme ?? '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{wg.regio ?? '—'}</td>
                          <td className="px-4 py-2.5 font-mono text-xs">{wg.telnringaand ?? '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {wg.idfacturering != null ? String(wg.idfacturering) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTarget(wg)}
                              aria-label={`Waarneemgroep ${wg.naam} verwijderen`}
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
            </div>
          </>
        )}
      </div>
    </>
  );
}
