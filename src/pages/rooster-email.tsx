'use client';

import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Mail, Send, Users } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { RoleTier } from '@/lib/roles';
import { hasSecretarisAccess } from '@/lib/roles';

const MAANDNAMEN = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
];

function maandOpties(startJaar: number, aantalMaanden: number): { label: string; maand: number; jaar: number }[] {
  const opties: { label: string; maand: number; jaar: number }[] = [];
  const nu = new Date();
  let maand = nu.getMonth();
  let jaar = startJaar;
  for (let i = 0; i < aantalMaanden; i++) {
    opties.push({ label: `${MAANDNAMEN[maand]} ${jaar}`, maand, jaar });
    maand++;
    if (maand > 11) {
      maand = 0;
      jaar++;
    }
  }
  return opties;
}

type Deelnemer = {
  id: number;
  voornaam: string | null;
  achternaam: string | null;
  login: string | null;
};

export default function RoosterEmailPage() {
  const { data: session } = useSession();
  const { activeWaarneemgroepId, activeWaarneemgroep } = useWaarneemgroep();
  const nu = new Date();

  // Eigen rooster versturen
  const [emailAdres, setEmailAdres] = useState('');
  const [eigenDiensten, setEigenDiensten] = useState(true);
  const [vanIndex, setVanIndex] = useState(0);
  const [totIndex, setTotIndex] = useState(2);
  const [bezig, setBezig] = useState(false);

  // Secretaris sectie
  const [roleTier, setRoleTier] = useState<RoleTier | null>(null);
  const [deelnemersList, setDeelnemersList] = useState<Deelnemer[]>([]);
  const [geselecteerd, setGeselecteerd] = useState<Set<number>>(new Set());
  const [secVanIndex, setSecVanIndex] = useState(0);
  const [secTotIndex, setSecTotIndex] = useState(2);
  const [secBezig, setSecBezig] = useState(false);

  const opties = maandOpties(nu.getFullYear(), 12);

  const sessionEmail = session?.user?.email ?? '';
  if (emailAdres === '' && sessionEmail) {
    setEmailAdres(sessionEmail);
  }

  useEffect(() => {
    fetch('/api/deelnemers/role')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.roleTier != null) setRoleTier(data.roleTier);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (roleTier == null || !hasSecretarisAccess(roleTier) || !activeWaarneemgroepId) return;
    fetch('/api/deelnemers')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.deelnemers) return;
        const gefilterd = (data.deelnemers as {
          id: number;
          voornaam: string | null;
          achternaam: string | null;
          login: string | null;
          waarneemgroepen?: { id: number; aangemeld: boolean }[];
        }[]).filter((d) =>
          d.waarneemgroepen?.some((wg) => String(wg.id) === activeWaarneemgroepId && wg.aangemeld)
        );
        setDeelnemersList(
          gefilterd
            .map((d) => ({ id: d.id, voornaam: d.voornaam, achternaam: d.achternaam, login: d.login }))
            .sort((a, b) => {
              const na = [a.achternaam, a.voornaam].filter(Boolean).join(' ');
              const nb = [b.achternaam, b.voornaam].filter(Boolean).join(' ');
              return na.localeCompare(nb, 'nl');
            })
        );
      })
      .catch(() => {});
  }, [roleTier, activeWaarneemgroepId]);

  async function verstuur() {
    if (!emailAdres.includes('@')) {
      toast.error('Vul een geldig e-mailadres in');
      return;
    }
    const van = opties[vanIndex];
    const tot = opties[Math.min(totIndex, opties.length - 1)];

    setBezig(true);
    try {
      const resp = await fetch('/api/rooster-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailAdres,
          vanMaand: van.maand,
          vanJaar: van.jaar,
          totMaand: tot.maand,
          totJaar: tot.jaar,
          eigenDiensten,
        }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: 'Onbekende fout' }));
        toast.error(body.error ?? 'Versturen mislukt');
        return;
      }

      toast.success('E-mail verstuurd!');
    } catch {
      toast.error('Versturen mislukt, probeer het later opnieuw');
    } finally {
      setBezig(false);
    }
  }

  const toggleDeelnemer = useCallback((id: number) => {
    setGeselecteerd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selecteerAlles = useCallback(() => {
    if (geselecteerd.size === deelnemersList.length) {
      setGeselecteerd(new Set());
    } else {
      setGeselecteerd(new Set(deelnemersList.map((d) => d.id)));
    }
  }, [deelnemersList, geselecteerd.size]);

  async function verstuurBevestiging() {
    if (geselecteerd.size === 0) {
      toast.error('Selecteer minimaal een deelnemer');
      return;
    }
    if (!activeWaarneemgroepId) {
      toast.error('Geen actieve waarneemgroep');
      return;
    }

    const van = opties[secVanIndex];
    const tot = opties[Math.min(secTotIndex, opties.length - 1)];

    setSecBezig(true);
    try {
      const resp = await fetch('/api/rooster-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'secretaris',
          idwaarneemgroep: Number(activeWaarneemgroepId),
          deelnemerIds: [...geselecteerd],
          vanMaand: van.maand,
          vanJaar: van.jaar,
          totMaand: tot.maand,
          totJaar: tot.jaar,
        }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: 'Onbekende fout' }));
        toast.error(body.error ?? 'Versturen mislukt');
        return;
      }

      const body = await resp.json() as { ok: boolean; verzonden?: number; mislukt?: string[] };
      if (body.mislukt?.length) {
        toast.warning(`${body.verzonden ?? 0} verstuurd, ${body.mislukt.length} mislukt: ${body.mislukt.join(', ')}`);
      } else {
        toast.success(`Bevestigingsmail verstuurd aan ${body.verzonden ?? geselecteerd.size} deelnemers`);
      }
    } catch {
      toast.error('Versturen mislukt, probeer het later opnieuw');
    } finally {
      setSecBezig(false);
    }
  }

  const isSecretaris = roleTier != null && hasSecretarisAccess(roleTier);

  return (
    <>
      <Head>
        <title>Rooster e-mailen | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-5" />
              Rooster e-mailen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Stuur het rooster per e-mail, bijvoorbeeld naar uw partner of een
              ander adres.
            </p>

            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                type="email"
                value={emailAdres}
                onChange={(e) => setEmailAdres(e.target.value)}
                placeholder="naam@voorbeeld.nl"
              />
              <p className="text-xs text-muted-foreground">
                Standaard uw eigen adres. Pas het aan om naar iemand anders te sturen.
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Wat wilt u versturen?</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="roosterType"
                    checked={eigenDiensten}
                    onChange={() => setEigenDiensten(true)}
                    className="accent-primary"
                  />
                  Alleen mijn diensten
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="roosterType"
                    checked={!eigenDiensten}
                    onChange={() => setEigenDiensten(false)}
                    className="accent-primary"
                  />
                  Heel rooster
                </label>
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vanMaand">Van</Label>
                <select
                  id="vanMaand"
                  value={vanIndex}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setVanIndex(idx);
                    if (totIndex < idx) setTotIndex(idx);
                  }}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {opties.map((o, i) => (
                    <option key={`van-${i}`} value={i}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totMaand">Tot en met</Label>
                <select
                  id="totMaand"
                  value={totIndex}
                  onChange={(e) => setTotIndex(Number(e.target.value))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {opties.filter((_, i) => i >= vanIndex).map((o, i) => (
                    <option key={`tot-${i}`} value={vanIndex + i}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              onClick={() => void verstuur()}
              disabled={bezig || !emailAdres}
              className="w-full"
            >
              <Send className="mr-2 size-4" />
              {bezig ? 'Versturen...' : 'Verstuur e-mail'}
            </Button>
          </CardContent>
        </Card>

        {isSecretaris && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5" />
                Bevestigingsmail versturen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Stuur deelnemers van{' '}
                <strong>{activeWaarneemgroep?.naam ?? 'de waarneemgroep'}</strong>{' '}
                een e-mail met hun persoonlijke diensten ter bevestiging.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="secVanMaand">Van</Label>
                  <select
                    id="secVanMaand"
                    value={secVanIndex}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setSecVanIndex(idx);
                      if (secTotIndex < idx) setSecTotIndex(idx);
                    }}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {opties.map((o, i) => (
                      <option key={`secvan-${i}`} value={i}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secTotMaand">Tot en met</Label>
                  <select
                    id="secTotMaand"
                    value={secTotIndex}
                    onChange={(e) => setSecTotIndex(Number(e.target.value))}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {opties.filter((_, i) => i >= secVanIndex).map((o, i) => (
                      <option key={`sectot-${i}`} value={secVanIndex + i}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Deelnemers</Label>
                  <button
                    type="button"
                    onClick={selecteerAlles}
                    className="text-xs text-primary hover:underline"
                  >
                    {geselecteerd.size === deelnemersList.length ? 'Alles deselecteren' : 'Alles selecteren'}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border p-2">
                  {deelnemersList.length === 0 ? (
                    <p className="py-2 text-center text-sm text-muted-foreground">
                      Geen deelnemers gevonden
                    </p>
                  ) : (
                    deelnemersList.map((d) => {
                      const naam = [d.voornaam, d.achternaam].filter(Boolean).join(' ') || 'Onbekend';
                      const heeftEmail = !!d.login?.includes('@');
                      return (
                        <label
                          key={d.id}
                          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={geselecteerd.has(d.id)}
                            onChange={() => toggleDeelnemer(d.id)}
                            className="accent-primary"
                          />
                          <span className={heeftEmail ? '' : 'text-muted-foreground'}>{naam}</span>
                          {!heeftEmail && (
                            <span className="text-xs text-destructive">(geen e-mail)</span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {geselecteerd.size} van {deelnemersList.length} geselecteerd
                </p>
              </div>

              <Button
                onClick={() => void verstuurBevestiging()}
                disabled={secBezig || geselecteerd.size === 0}
                className="w-full"
              >
                <Send className="mr-2 size-4" />
                {secBezig ? 'Versturen...' : `Verstuur bevestigingsmail (${geselecteerd.size})`}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
