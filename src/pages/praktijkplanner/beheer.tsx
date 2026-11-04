'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PraktijkplannerPage, type PraktijkplannerPageContext } from '@/components/praktijkplanner/PraktijkplannerPage';
import { ActiviteitenIconPicker } from '@/components/praktijkplanner/ActiviteitenIconPicker';
import { SchedulableDaypartsEditor } from '@/components/praktijkplanner/SchedulableDaypartsEditor';
import { DaypartTimesEditor } from '@/components/praktijkplanner/DaypartTimesEditor';
import { ParticipantSchedulableDaypartsEditor } from '@/components/praktijkplanner/ParticipantSchedulableDaypartsEditor';
import type { PraktijkplannerMasterData } from '@/types/praktijkplanner';

type Entity =
  | 'expertise'
  | 'activity'
  | 'specification'
  | 'location'
  | 'absenceType'
  | 'availabilityType'
  | 'task'
  | 'functie';

type BeheerTab = Entity | 'dayparts';

type Form = Record<string, string | boolean>;

const TABS: Array<{ id: BeheerTab; label: string }> = [
  { id: 'activity', label: 'Activiteiten' },
  { id: 'task', label: 'Taken' },
  { id: 'location', label: 'Locaties' },
  { id: 'absenceType', label: 'Afwezigheidstypen' },
  // { id: 'availabilityType', label: 'Beschikbaarheid' },
  { id: 'expertise', label: 'Expertises' },
  { id: 'functie', label: 'Functies' },
  { id: 'dayparts', label: 'Dagdelen' },
  // { id: 'specification', label: 'Specificaties' },

];

function initialForm(): Form {
  return { actief: true, nietLocatieGebonden: false, inbelbaar: false, inbelnummer: '', isDienst: false };
}

function getItems(masterData: PraktijkplannerMasterData, entity: Entity) {
  switch (entity) {
    case 'expertise':
      return masterData.expertises;
    case 'activity':
      return masterData.activities;
    case 'specification':
      return masterData.specifications;
    case 'location':
      return masterData.locations;
    case 'absenceType':
      return masterData.absenceTypes;
    case 'availabilityType':
      return masterData.availabilityTypes;
    case 'task':
      return masterData.tasks;
    case 'functie':
      return masterData.functies ?? [];
  }
}

function itemFullName(entity: Entity, item: Record<string, unknown>): string {
  if (entity === 'task') {
    return String(item.omschrijving ?? item.afkorting ?? `Taak ${item.id}`);
  }
  return String(item.naam ?? item.afkorting ?? `Item ${item.id}`);
}

function itemShortLabel(entity: Entity, item: Record<string, unknown>): string {
  if (entity === 'functie') return '';
  if (['absenceType', 'availabilityType'].includes(entity)) {
    return String(item.code ?? '');
  }
  return String(item.afkorting ?? '');
}

/** Een functie heeft alleen een naam, dus de tweede kolom zou daar altijd leeg zijn. */
function heeftTweedeKolom(entity: Entity): boolean {
  return entity !== 'functie';
}

/**
 * Voorbeelden die een secretaris met een klik overneemt.
 *
 * Voorbeelden, geen vaste lijst: elke groep bepaalt zelf welke functies hij heeft. Ze staan
 * hier omdat een leeg tabblad geen idee geeft van wat er wordt bedoeld.
 */
const FUNCTIE_VOORBEELDEN = ['Specialist', 'Assistent', 'Ajo', 'Toa'];

function compareItemsByName(entity: Entity, a: Record<string, unknown>, b: Record<string, unknown>): number {
  return itemFullName(entity, a).localeCompare(itemFullName(entity, b), 'nl', { sensitivity: 'base' });
}

function RequiredAsterisk() {
  return <span className="text-[#c91b23]">*</span>;
}

function hasRequiredName(entity: Entity, form: Form): boolean {
  const value = entity === 'task' ? form.omschrijving : form.naam;
  return String(value ?? '').trim().length > 0;
}

function requiresAfkorting(entity: Entity): boolean {
  return !['absenceType', 'availabilityType', 'functie'].includes(entity);
}

function hasRequiredAfkorting(entity: Entity, form: Form): boolean {
  if (!requiresAfkorting(entity)) return true;
  return String(form.afkorting ?? '').trim().length > 0;
}

const DEFAULT_KLEUR = '#cccccc';

const VALID_TABS = new Set<BeheerTab>(TABS.map((tab) => tab.id));

function parseTab(value: unknown): BeheerTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === 'string' && VALID_TABS.has(raw as BeheerTab)) {
    return raw as BeheerTab;
  }
  return 'activity';
}

function readTabFromUrl(): BeheerTab {
  if (typeof window === 'undefined') return 'activity';
  return parseTab(new URLSearchParams(window.location.search).get('entity'));
}

function BeheerContent({ groupId, data, reload: reloadContext }: PraktijkplannerPageContext) {
  const router = useRouter();
  const tab = useMemo((): BeheerTab => {
    if (router.isReady) {
      return parseTab(router.query.entity);
    }
    return readTabFromUrl();
  }, [router.isReady, router.query.entity]);

  const entity: Entity = tab === 'dayparts' ? 'activity' : tab;

  const setTab = useCallback((next: BeheerTab) => {
    void router.replace(
      { pathname: router.pathname, query: { ...router.query, entity: next } },
      undefined,
      { shallow: true }
    );
  }, [router]);
  const [masterData, setMasterData] = useState<PraktijkplannerMasterData>({
    ...data.masterData,
    daypartTimes: data.masterData.daypartTimes ?? [],
    schedulableDayparts: data.masterData.schedulableDayparts ?? [],
    participantSchedulableDayparts: data.masterData.participantSchedulableDayparts ?? [],
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const abortController = new AbortController();
    setLoading(true);
    fetch(`/api/praktijkplanner/master-data?idwaarneemgroep=${groupId}&includeInactive=true`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as PraktijkplannerMasterData | { error?: string };
        if (!response.ok || !('dayparts' in payload)) throw new Error('error' in payload ? payload.error : 'Stamgegevens konden niet worden geladen.');
        return payload;
      })
      .then((payload) => {
        if (!abortController.signal.aborted) setMasterData(payload);
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          toast.error(error instanceof Error ? error.message : 'Stamgegevens konden niet worden geladen.');
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false);
      });
    return () => abortController.abort();
  }, [groupId]);

  useEffect(() => load(), [load]);

  useEffect(() => {
    setEditingId(null);
    setForm(initialForm());
  }, [tab]);

  const items = useMemo(() => {
    const list = getItems(masterData, entity) as Array<Record<string, unknown>>;
    return [...list].sort((a, b) => compareItemsByName(entity, a, b));
  }, [entity, masterData]);

  const selectItem = (item: Record<string, unknown>) => {
    setEditingId(Number(item.id));
    setForm({
      ...item,
      idexpertise: item.idexpertise ? String(item.idexpertise) : '',
      idactiviteit: item.idactiviteit ? String(item.idactiviteit) : '',
      idlocatie: item.idlocatie ? String(item.idlocatie) : '',
      actief: item.actief !== false,
      nietLocatieGebonden: item.nietLocatieGebonden === true,
      inbelbaar: item.inbelbaar === true,
      inbelnummer: String(item.inbelnummer ?? ''),
      isDienst: item.isDienst === true,
      omschrijving: String(item.omschrijving ?? ''),
      naam: String(item.naam ?? ''),
      afkorting: String(item.afkorting ?? ''),
      kleur: String(item.kleur ?? ''),
      icon: String(item.icon ?? ''),
      code: String(item.code ?? ''),
      type: String(item.type ?? ''),
    });
  };

  const submit = async () => {
    if (!hasRequiredName(entity, form) || !hasRequiredAfkorting(entity, form)) {
      toast.error(requiresAfkorting(entity) ? 'Naam en afkorting zijn verplicht.' : 'Naam is verplicht.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/praktijkplanner/master-data', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          entity,
          action: editingId ? 'update' : 'create',
          id: editingId ?? undefined,
          ...form,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Opslaan mislukt.');
      toast.success(editingId ? 'Stamgegeven bijgewerkt.' : 'Stamgegeven toegevoegd.');
      setEditingId(null);
      setForm(initialForm());
      load();
      reloadContext();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!editingId) return;
    try {
      const response = await fetch('/api/praktijkplanner/master-data', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          entity,
          action: 'archive',
          id: editingId,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Archiveren mislukt.');
      toast.success('Stamgegeven gearchiveerd.');
      setEditingId(null);
      setForm(initialForm());
      load();
      reloadContext();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Archiveren mislukt.');
    }
  };

  if (!data.isManager) {
    return <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Plannerbeheer is alleen beschikbaar voor secretarissen en beheerders.</p>;
  }

  if (tab === 'dayparts') {
    return (
      <div className="space-y-4">
        <div className="mb-1 flex flex-wrap gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                'rounded px-2 py-1 text-xs font-medium',
                tab === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
        <SchedulableDaypartsEditor
          groupId={groupId}
          dayparts={masterData.dayparts}
          schedulableDayparts={masterData.schedulableDayparts ?? []}
          onSaved={(next) => {
            setMasterData((current) => ({ ...current, schedulableDayparts: next }));
            reloadContext();
          }}
        />
        <DaypartTimesEditor
          groupId={groupId}
          dayparts={masterData.dayparts}
          daypartTimes={masterData.daypartTimes ?? []}
          onSaved={(next) => {
            setMasterData((current) => ({ ...current, daypartTimes: next }));
            reloadContext();
          }}
        />
        <ParticipantSchedulableDaypartsEditor
          groupId={groupId}
          participants={data.participants}
          dayparts={masterData.dayparts}
          groupSchedulableDayparts={masterData.schedulableDayparts ?? []}
          participantSchedulableDayparts={masterData.participantSchedulableDayparts ?? []}
          onSaved={(iddeelnemer, nextForParticipant) => {
            setMasterData((current) => ({
              ...current,
              participantSchedulableDayparts: [
                ...(current.participantSchedulableDayparts ?? []).filter(
                  (row) => row.iddeelnemer !== iddeelnemer
                ),
                ...nextForParticipant,
              ],
            }));
            reloadContext();
          }}
        />
      </div>
    );
  }

  // Voorbeelden die deze groep nog niet heeft. Alles al aanwezig betekent geen voorbeeldenblok.
  const openVoorbeelden =
    entity === 'functie'
      ? FUNCTIE_VOORBEELDEN.filter(
          (voorbeeld) =>
            !items.some(
              (item) => String(item.naam ?? '').toLowerCase() === voorbeeld.toLowerCase()
            )
        )
      : [];

  const showExpertise = ['activity', 'task'].includes(entity);
  const showActivity = entity === 'specification';
  const showCode = ['absenceType', 'availabilityType'].includes(entity);
  const showVisual = ['activity', 'specification', 'location', 'absenceType', 'availabilityType', 'task'].includes(entity);
  const canSubmit = hasRequiredName(entity, form) && hasRequiredAfkorting(entity, form);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                'rounded px-2 py-1 text-xs font-medium',
                tab === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="max-h-[620px] overflow-y-auto">
          {loading ? <p className="p-2 text-sm text-muted-foreground">Laden…</p> : null}
          {!loading && items.length > 0 ? (
            <div
              className={[
                'grid gap-x-2 border-b px-2 py-1.5 text-xs font-medium text-muted-foreground',
                heeftTweedeKolom(entity)
                  ? 'grid-cols-[minmax(0,1fr)_minmax(0,6rem)]'
                  : 'grid-cols-1',
              ].join(' ')}
            >
              <span>Naam</span>
              {heeftTweedeKolom(entity) ? (
                <span>{['absenceType', 'availabilityType'].includes(entity) ? 'Code' : 'Afkorting'}</span>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-1">
            {items.map((item) => {
              const active = item.actief !== false;
              const shortLabel = itemShortLabel(entity, item);
              return (
                <button
                  type="button"
                  key={Number(item.id)}
                  onClick={() => selectItem(item)}
                  className={[
                    'grid w-full gap-x-2 rounded px-2 py-2 text-left text-sm hover:bg-muted',
                    heeftTweedeKolom(entity)
                      ? 'grid-cols-[minmax(0,1fr)_minmax(0,6rem)]'
                      : 'grid-cols-1',
                    editingId === Number(item.id) ? 'bg-muted' : '',
                    !active ? 'opacity-50' : '',
                  ].join(' ')}
                >
                  <span className="truncate">{itemFullName(entity, item)}</span>
                  {heeftTweedeKolom(entity) ? (
                    <span className="truncate text-muted-foreground">{shortLabel || '—'}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {items.length === 0 && !loading ? (
            <p className="p-2 text-sm text-muted-foreground">
              {entity === 'functie'
                ? 'Nog geen functies. Deze waarneemgroep bepaalt zelf welke functies hij heeft.'
                : 'Nog geen gegevens.'}
            </p>
          ) : null}
        </div>
        {entity === 'functie' && openVoorbeelden.length > 0 ? (
          <div className="mt-3 border-t pt-3">
            <p className="mb-1.5 text-xs text-muted-foreground">
              Voorbeelden, klik om over te nemen:
            </p>
            <div className="flex flex-wrap gap-1">
              {openVoorbeelden.map((voorbeeld) => (
                <button
                  key={voorbeeld}
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm({ ...initialForm(), naam: voorbeeld });
                  }}
                  className="rounded border px-2 py-1 text-xs hover:bg-muted"
                >
                  {voorbeeld}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{editingId ? 'Stamgegeven bewerken' : 'Stamgegeven toevoegen'}</h2>
            <p className="text-sm text-muted-foreground">{TABS.find((tab) => tab.id === entity)?.label}</p>
          </div>
          {editingId ? (
            <button type="button" className="inline-flex items-center gap-1 rounded border px-2 py-1.5 text-sm hover:bg-muted" onClick={() => { setEditingId(null); setForm(initialForm()); }}>
              <Plus className="size-4" /> Nieuw
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Naam <RequiredAsterisk /></span>
            <input
              required
              className="h-9 rounded border bg-background px-2"
              value={entity === 'task' ? String(form.omschrijving ?? '') : String(form.naam ?? '')}
              onChange={(event) => setForm((current) => (
                entity === 'task'
                  ? { ...current, omschrijving: event.target.value }
                  : { ...current, naam: event.target.value }
              ))}
            />
          </label>
          {requiresAfkorting(entity) ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Afkorting <RequiredAsterisk /></span>
              <input
                required
                className="h-9 rounded border bg-background px-2"
                value={String(form.afkorting ?? '')}
                onChange={(event) => setForm((current) => ({ ...current, afkorting: event.target.value }))}
              />
            </label>
          ) : null}
          {showExpertise ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Expertise</span>
              <select className="h-9 rounded border bg-background px-2" value={String(form.idexpertise ?? '')} onChange={(event) => setForm((current) => ({ ...current, idexpertise: event.target.value }))}>
                <option value="">Geen expertise</option>
                {masterData.expertises.filter((item) => item.actief).map((item) => <option key={item.id} value={item.id}>{item.naam}</option>)}
              </select>
            </label>
          ) : null}
          {showActivity ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Activiteit</span>
              <select className="h-9 rounded border bg-background px-2" value={String(form.idactiviteit ?? '')} onChange={(event) => setForm((current) => ({ ...current, idactiviteit: event.target.value }))}>
                <option value="">Kies activiteit</option>
                {masterData.activities.filter((item) => item.actief).map((item) => <option key={item.id} value={item.id}>{item.naam}</option>)}
              </select>
            </label>
          ) : null}
          {showCode ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Code</span>
              <input className="h-9 rounded border bg-background px-2" value={String(form.code ?? '')} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
            </label>
          ) : null}
          {entity === 'availabilityType' ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Type</span>
              <input className="h-9 rounded border bg-background px-2" value={String(form.type ?? 'fte')} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} />
            </label>
          ) : null}
          {showVisual ? (
            <>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Kleur</span>
                <div className="flex h-9 items-center gap-2">
                  <button
                    type="button"
                    title="Wijzig kleur"
                    onClick={() => colorInputRef.current?.click()}
                    className="h-6 w-10 rounded border border-input shadow-sm transition-transform hover:scale-105"
                    style={{ backgroundColor: String(form.kleur ?? '') || DEFAULT_KLEUR }}
                  />
                  <input
                    ref={colorInputRef}
                    type="color"
                    className="sr-only"
                    value={String(form.kleur ?? '') || DEFAULT_KLEUR}
                    onChange={(event) => setForm((current) => ({ ...current, kleur: event.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => colorInputRef.current?.click()}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Wijzig
                  </button>
                </div>
              </label>
              {entity !== 'location' && entity !== 'task' ? (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Icoon</span>
                  <ActiviteitenIconPicker
                    groupId={groupId}
                    value={String(form.icon ?? '')}
                    onChange={(icon) => setForm((current) => ({ ...current, icon }))}
                  />
                </label>
              ) : null}
            </>
          ) : null}
          {/* {entity === 'location' ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Kamer nummer</span>
              <input className="h-9 rounded border bg-background px-2" inputMode="numeric" value={String(form.idlocatie ?? '')} onChange={(event) => setForm((current) => ({ ...current, idlocatie: event.target.value }))} />
            </label>
          ) : null} */}
          {entity === 'task' ? (
            <label className="flex items-start gap-2 text-sm md:col-span-2">
              <Checkbox
                className="mt-0.5"
                checked={form.nietLocatieGebonden === true}
                onCheckedChange={(value) => setForm((current) => ({ ...current, nietLocatieGebonden: !!value }))}
              />
              <span className="grid gap-0.5">
                <Label className="cursor-pointer">Kan op elke locatie</Label>
                <span className="text-xs text-muted-foreground">
                  Bijvoorbeeld een telefonisch extern consult. In de Capaciteitsplanner vult u zulke
                  taken een keer in voor de hele waarneemgroep in plaats van bij elke locatie apart.
                </span>
              </span>
            </label>
          ) : null}
          {entity === 'task' ? (
            <label className="flex items-start gap-2 text-sm md:col-span-2">
              <Checkbox
                className="mt-0.5"
                checked={form.inbelbaar === true}
                onCheckedChange={(value) => setForm((current) => ({ ...current, inbelbaar: !!value }))}
              />
              <span className="grid gap-0.5">
                <Label className="cursor-pointer">Hierop kan worden ingebeld</Label>
                <span className="text-xs text-muted-foreground">
                  Voor taken waarbij collega&apos;s de dienstdoende dokter mogen bellen, zoals een extern
                  consult. In het rooster komt er dan een telefoonicoontje bij te staan.
                </span>
              </span>
            </label>
          ) : null}
          {/*
            Alleen zichtbaar als het vinkje aanstaat. Een nummer bij een taak die niet inbelbaar
            is wordt nergens getoond, dus een leeg veld dat altijd meekijkt is een vraag zonder
            antwoord.
          */}
          {entity === 'task' && form.inbelbaar === true ? (
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium">Nummer om op in te bellen</span>
              <input
                className="h-9 rounded border bg-background px-2"
                maxLength={30}
                placeholder="Bijvoorbeeld 088 123 4567"
                value={String(form.inbelnummer ?? '')}
                onChange={(event) => setForm((current) => ({ ...current, inbelnummer: event.target.value }))}
              />
              <span className="text-xs text-muted-foreground">
                Mag leeg blijven; het telefoonicoontje staat er dan nog steeds. Vult u een nummer
                in, dan verschijnt het bij de taak zodra iemand met de muis over een dagdeel gaat.
                In het rooster zelf is er geen ruimte voor.
              </span>
            </label>
          ) : null}
          {entity === 'task' ? (
            <label className="flex items-start gap-2 text-sm md:col-span-2">
              <Checkbox
                className="mt-0.5"
                checked={form.isDienst === true}
                onCheckedChange={(value) => setForm((current) => ({ ...current, isDienst: !!value }))}
              />
              <span className="grid gap-0.5">
                <Label className="cursor-pointer">Dit is een dienst</Label>
                <span className="text-xs text-muted-foreground">
                  Zo&apos;n taak mag ook op een dagdeel waarop de dokter normaal niet werkt, want een
                  nachtdienst valt daar altijd buiten. Herhalen, een week kopi&euml;ren en Leegmaken
                  laten hem staan: een dienst haalt u alleen weg door hem zelf aan te klikken.
                </span>
              </span>
            </label>
          ) : null}
          {editingId ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.actief !== false} onCheckedChange={(value) => setForm((current) => ({ ...current, actief: !!value }))} />
              <Label className="cursor-pointer">Actief</Label>
            </label>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" disabled={saving || !canSubmit} onClick={submit} className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            <Save className="size-4" /> {saving ? 'Opslaan…' : editingId ? 'Bijwerken' : 'Toevoegen'}
          </button>
          {editingId ? (
            <button type="button" onClick={archive} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-muted">
              <Archive className="size-4" /> Archiveren
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default function PlannerbeheerPage() {
  return (
    <>
      <Head>
        <title>Plannerbeheer | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage
        title="Plannerbeheer"
      >
        {(context) => <BeheerContent {...context} />}
      </PraktijkplannerPage>
    </>
  );
}
