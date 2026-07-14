'use client';

import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { PraktijkplannerPage, type PraktijkplannerPageContext } from '@/components/praktijkplanner/PraktijkplannerPage';
import type { PraktijkplannerYearBalance } from '@/types/praktijkplanner';

type EditableBalance = Pick<
  PraktijkplannerYearBalance,
  'absenceType' | 'beginsaldo' | 'budget' | 'correctie' | 'mutaties' | 'totaal'
>;

function participantName(participant: PraktijkplannerPageContext['data']['participants'][number]) {
  return (
    [participant.voornaam, participant.achternaam].filter(Boolean).join(' ') ||
    participant.name ||
    participant.initialen ||
    `Deelnemer ${participant.id}`
  );
}

function DoctorAbsenceContent({ groupId, data }: PraktijkplannerPageContext) {
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [balances, setBalances] = useState<EditableBalance[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedParticipantId != null || data.participants.length === 0) return;
    setSelectedParticipantId(data.participants[0].id);
  }, [data.participants, selectedParticipantId]);

  const load = useCallback(() => {
    if (!selectedParticipantId) return;
    const abortController = new AbortController();
    setLoading(true);
    fetch(
      `/api/praktijkplanner/afwezigheden/balansen?idwaarneemgroep=${groupId}&iddeelnemer=${selectedParticipantId}&jaar=${year}`,
      { credentials: 'include', signal: abortController.signal }
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          balances?: PraktijkplannerYearBalance[];
          note?: string;
          error?: string;
        };
        if (!response.ok || !payload.balances) throw new Error(payload.error || 'Balans kon niet worden geladen.');
        return payload;
      })
      .then((payload) => {
        if (!abortController.signal.aborted) {
          setBalances(payload.balances ?? []);
          setNote(payload.note ?? '');
        }
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          toast.error(error instanceof Error ? error.message : 'Balans kon niet worden geladen.');
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false);
      });
    return () => abortController.abort();
  }, [groupId, selectedParticipantId, year]);

  useEffect(() => load(), [load]);

  const updateBalance = (index: number, key: 'beginsaldo' | 'budget' | 'correctie', value: string) => {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) return;
    setBalances((current) =>
      current.map((balance, itemIndex) =>
        itemIndex === index
          ? {
              ...balance,
              [key]: numeric,
              totaal:
                (key === 'beginsaldo' ? numeric : balance.beginsaldo) +
                (key === 'budget' ? numeric : balance.budget) +
                (key === 'correctie' ? numeric : balance.correctie) -
                balance.mutaties,
            }
          : balance
      )
    );
  };

  const save = useCallback(async () => {
    if (!data.isManager || !selectedParticipantId) return;
    setSaving(true);
    try {
      const response = await fetch('/api/praktijkplanner/afwezigheden/balansen', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          iddeelnemer: selectedParticipantId,
          jaar: year,
          note,
          balances: balances.map((balance) => ({
            idafwezigheidstype: balance.absenceType.id,
            beginsaldo: balance.beginsaldo,
            budget: balance.budget,
            correctie: balance.correctie,
          })),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Opslaan mislukt.');
      toast.success('Afwezigheidsbalans opgeslagen.');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  }, [balances, data.isManager, groupId, load, note, selectedParticipantId, year]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
        {data.isManager ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Deelnemer</span>
            <select
              value={selectedParticipantId ?? ''}
              onChange={(event) => setSelectedParticipantId(Number(event.target.value) || null)}
              className="h-9 rounded border bg-background px-2"
            >
              {data.participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participantName(participant)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Jaar</span>
          <input
            type="number"
            min="2000"
            max="2100"
            value={year}
            onChange={(event) => setYear(Number(event.target.value) || new Date().getFullYear())}
            className="h-9 w-24 rounded border bg-background px-2"
          />
        </label>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Balans laden…</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Afwezigheidstype</th>
              <th className="p-3 text-right">Beginsaldo</th>
              <th className="p-3 text-right">Budget</th>
              <th className="p-3 text-right">Correctie</th>
              <th className="p-3 text-right">Mutaties</th>
              <th className="p-3 text-right">Resterend</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((balance, index) => (
              <tr key={balance.absenceType.id} className="border-t">
                <td className="p-3 font-medium">{balance.absenceType.naam}</td>
                {(['beginsaldo', 'budget', 'correctie'] as const).map((key) => (
                  <td key={key} className="p-3 text-right">
                    {data.isManager ? (
                      <input
                        type="number"
                        value={balance[key]}
                        min={key === 'correctie' ? undefined : 0}
                        onChange={(event) => updateBalance(index, key, event.target.value)}
                        className="h-8 w-20 rounded border bg-background px-2 text-right"
                      />
                    ) : (
                      balance[key]
                    )}
                  </td>
                ))}
                <td className="p-3 text-right">{balance.mutaties}</td>
                <td className="p-3 text-right font-semibold">{balance.totaal}</td>
              </tr>
            ))}
            {balances.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Geen afwezigheidstypen beschikbaar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <label className="block rounded-xl border bg-card p-3 shadow-sm">
        <span className="mb-2 block text-sm font-medium">Notitie voor {year}</span>
        {data.isManager ? (
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-24 w-full rounded border bg-background p-2 text-sm"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{note || 'Geen notitie.'}</p>
        )}
      </label>

      {data.isManager ? (
        <button
          type="button"
          disabled={saving || !selectedParticipantId}
          onClick={save}
          className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <Save className="size-4" /> {saving ? 'Opslaan…' : 'Opslaan'}
        </button>
      ) : null}
    </div>
  );
}

export default function DokterAfwezigheidPage() {
  return (
    <>
      <Head>
        <title>Dokter absence | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage
        title="Dokter absence"
        description="Bekijk uw afwezigheidsbudget en resterende dagdelen per jaar."
      >
        {(context) => <DoctorAbsenceContent {...context} />}
      </PraktijkplannerPage>
    </>
  );
}
