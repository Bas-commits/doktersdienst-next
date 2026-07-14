'use client';

import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PraktijkplannerPage, type PraktijkplannerPageContext } from '@/components/praktijkplanner/PraktijkplannerPage';
import type { PraktijkplannerMasterData } from '@/types/praktijkplanner';

type Entity =
  | 'expertise'
  | 'activity'
  | 'specification'
  | 'location'
  | 'absenceType'
  | 'availabilityType'
  | 'task';

type Form = Record<string, string | boolean>;

const TABS: Array<{ id: Entity; label: string }> = [
  { id: 'expertise', label: 'Expertises' },
  { id: 'activity', label: 'Activiteiten' },
  { id: 'specification', label: 'Specificaties' },
  { id: 'task', label: 'Taken' },
  { id: 'location', label: 'Plannerlocaties' },
  { id: 'absenceType', label: 'Afwezigheidstypen' },
  { id: 'availabilityType', label: 'Beschikbaarheid' },
];

function initialForm(): Form {
  return { actief: true };
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
  }
}

function itemLabel(entity: Entity, item: Record<string, unknown>) {
  if (entity === 'task') return String(item.afkorting || item.omschrijving || `Taak ${item.id}`);
  return String(item.afkorting || item.naam || `Item ${item.id}`);
}

function BeheerContent({ groupId, data, reload: reloadContext }: PraktijkplannerPageContext) {
  const [entity, setEntity] = useState<Entity>('expertise');
  const [masterData, setMasterData] = useState<PraktijkplannerMasterData>(data.masterData);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
  }, [entity]);

  const items = useMemo(
    () => getItems(masterData, entity) as Array<Record<string, unknown>>,
    [entity, masterData]
  );

  const selectItem = (item: Record<string, unknown>) => {
    setEditingId(Number(item.id));
    setForm({
      ...item,
      idexpertise: item.idexpertise ? String(item.idexpertise) : '',
      idactiviteit: item.idactiviteit ? String(item.idactiviteit) : '',
      idlocatie: item.idlocatie ? String(item.idlocatie) : '',
      actief: item.actief !== false,
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

  if (!data.isAdmin) {
    return <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Plannerbeheer is alleen beschikbaar voor beheerders.</p>;
  }

  const showExpertise = ['activity', 'task'].includes(entity);
  const showActivity = entity === 'specification';
  const showName = entity !== 'task';
  const showCode = ['absenceType', 'availabilityType'].includes(entity);
  const showVisual = ['activity', 'specification', 'location', 'absenceType', 'availabilityType', 'task'].includes(entity);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setEntity(tab.id)}
              className={[
                'rounded px-2 py-1 text-xs font-medium',
                entity === tab.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="max-h-[620px] space-y-1 overflow-y-auto">
          {loading ? <p className="p-2 text-sm text-muted-foreground">Laden…</p> : null}
          {items.map((item) => {
            const active = item.actief !== false;
            return (
              <button
                type="button"
                key={Number(item.id)}
                onClick={() => selectItem(item)}
                className={[
                  'flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-muted',
                  editingId === Number(item.id) ? 'bg-muted' : '',
                  !active ? 'opacity-50' : '',
                ].join(' ')}
              >
                <span className="truncate">{itemLabel(entity, item)}</span>
                {!active ? <span className="ml-2 text-[10px] uppercase text-muted-foreground">Gearchiveerd</span> : null}
              </button>
            );
          })}
          {items.length === 0 && !loading ? <p className="p-2 text-sm text-muted-foreground">Nog geen gegevens.</p> : null}
        </div>
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
          {showName ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Naam</span>
              <input className="h-9 rounded border bg-background px-2" value={String(form.naam ?? '')} onChange={(event) => setForm((current) => ({ ...current, naam: event.target.value }))} />
            </label>
          ) : (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Omschrijving</span>
              <input className="h-9 rounded border bg-background px-2" value={String(form.omschrijving ?? '')} onChange={(event) => setForm((current) => ({ ...current, omschrijving: event.target.value }))} />
            </label>
          )}
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Afkorting</span>
            <input className="h-9 rounded border bg-background px-2" value={String(form.afkorting ?? '')} onChange={(event) => setForm((current) => ({ ...current, afkorting: event.target.value }))} />
          </label>
          {showExpertise ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Expertise</span>
              <select className="h-9 rounded border bg-background px-2" value={String(form.idexpertise ?? '')} onChange={(event) => setForm((current) => ({ ...current, idexpertise: event.target.value }))}>
                <option value="">Kies expertise</option>
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
                <input className="h-9 rounded border bg-background px-2" placeholder="#c91b23" value={String(form.kleur ?? '')} onChange={(event) => setForm((current) => ({ ...current, kleur: event.target.value }))} />
              </label>
              {entity !== 'location' && entity !== 'task' ? (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Icoon</span>
                  <input className="h-9 rounded border bg-background px-2" placeholder="education.svg" value={String(form.icon ?? '')} onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))} />
                </label>
              ) : null}
            </>
          ) : null}
          {entity === 'location' ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Bestaande Doktersdienst-locatie (optioneel)</span>
              <input className="h-9 rounded border bg-background px-2" inputMode="numeric" value={String(form.idlocatie ?? '')} onChange={(event) => setForm((current) => ({ ...current, idlocatie: event.target.value }))} />
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
          <button type="button" disabled={saving} onClick={submit} className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
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
        description="Beheer de stamgegevens die in Praktijkplanner gebruikt worden."
      >
        {(context) => <BeheerContent {...context} />}
      </PraktijkplannerPage>
    </>
  );
}
