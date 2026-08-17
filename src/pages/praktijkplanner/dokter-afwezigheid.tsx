'use client';

import Head from 'next/head';
import { ChevronDown, Download } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AbsenceDaypartCell } from '@/components/praktijkplanner/AbsenceDaypartCell';
import { PraktijkplannerPage, type PraktijkplannerPageContext } from '@/components/praktijkplanner/PraktijkplannerPage';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { downloadAbsentietelling } from '@/lib/absentietelling-export';
import { naamVoorBestandsnaam } from '@/lib/excel-export';
import type { PraktijkplannerYearBalance, PraktijkplannerYearBalanceMutation } from '@/types/praktijkplanner';

const AUTOSAVE_DEBOUNCE_MS = 400;

type EditableBalance = Pick<
  PraktijkplannerYearBalance,
  | 'absenceType'
  | 'beginsaldo'
  | 'budget'
  | 'mutaties'
  | 'mutatiesVoorlopig'
  | 'mutatieDatums'
  | 'mutatieDatumsVoorlopig'
  | 'totaal'
  | 'totaalVoorlopig'
>;

function participantName(participant: PraktijkplannerPageContext['data']['participants'][number]) {
  return (
    [participant.voornaam, participant.achternaam].filter(Boolean).join(' ') ||
    participant.name ||
    participant.initialen ||
    `Deelnemer ${participant.id}`
  );
}

function formatMutationDate(isoDate: string) {
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00`));
}

function MutationDatesDropdown({ datums }: { datums: PraktijkplannerYearBalanceMutation[] }) {
  if (datums.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex size-6 shrink-0 items-center justify-center rounded border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={datums.length === 1 ? '1 datum tonen' : `${datums.length} datums tonen`}
      >
        <ChevronDown className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2" sideOffset={6}>
        <PopoverHeader className="px-1.5 pb-1">
          <PopoverTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {datums.length === 1 ? '1 datum' : `${datums.length} datums`}
          </PopoverTitle>
          <PopoverDescription className="sr-only">
            Datums waarop deze afwezigheid is toegekend in het geselecteerde jaar.
          </PopoverDescription>
        </PopoverHeader>
        <ul className="max-h-64 overflow-y-auto py-0.5">
          {datums.map((entry) => (
            <li key={`${entry.datum}-${entry.dagdeel}`} className="px-1.5 py-1 text-sm text-foreground">
              {formatMutationDate(entry.datum)}
              <span className="text-muted-foreground"> · {entry.dagdeel}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function DoctorAbsenceContent({ groupId, data }: PraktijkplannerPageContext) {
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [balances, setBalances] = useState<EditableBalance[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const skipNextSaveRef = useRef(true);

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
          skipNextSaveRef.current = true;
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

  const updateBalance = (index: number, key: 'beginsaldo' | 'budget', value: string) => {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) return;
    setBalances((current) =>
      current.map((balance, itemIndex) => {
        if (itemIndex !== index) return balance;
        const beginsaldo = key === 'beginsaldo' ? numeric : balance.beginsaldo;
        const budget = key === 'budget' ? numeric : balance.budget;
        const available = beginsaldo + budget;
        return {
          ...balance,
          beginsaldo,
          budget,
          totaal: available - balance.mutaties,
          totaalVoorlopig: available - balance.mutaties - balance.mutatiesVoorlopig,
        };
      })
    );
  };

  useEffect(() => {
    if (!data.isManager || !selectedParticipantId || loading) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const abortController = new AbortController();
    const timer = window.setTimeout(() => {
      setSaving(true);
      fetch('/api/praktijkplanner/afwezigheden/balansen', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          iddeelnemer: selectedParticipantId,
          jaar: year,
          note,
          balances: balances.map((balance) => ({
            idafwezigheidstype: balance.absenceType.id,
            beginsaldo: balance.beginsaldo,
            budget: balance.budget,
          })),
        }),
      })
        .then(async (response) => {
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) throw new Error(payload.error || 'Opslaan mislukt.');
        })
        .catch((error: unknown) => {
          if (abortController.signal.aborted) return;
          toast.error(error instanceof Error ? error.message : 'Opslaan mislukt.');
        })
        .finally(() => {
          if (!abortController.signal.aborted) setSaving(false);
        });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [balances, data.isManager, groupId, loading, note, selectedParticipantId, year]);

  const gekozenNaam =
    data.participants.find((participant) => participant.id === selectedParticipantId) ?? null;

  /** Zet de balans en de losse afwezige dagdelen van deze deelnemer in een Excel-bestand. */
  async function handleDownload() {
    const naam = gekozenNaam ? participantName(gekozenNaam) : 'deelnemer';
    setDownloading(true);
    try {
      await downloadAbsentietelling({
        bestandsnaam: `absentietelling-${naamVoorBestandsnaam(naam)}-${year}.xlsx`,
        deelnemer: naam,
        jaar: year,
        notitie: note,
        regels: balances.map((balance) => ({
          type: balance.absenceType.naam,
          beginsaldo: balance.beginsaldo,
          budget: balance.budget,
          mutaties: balance.mutaties,
          mutatiesVoorlopig: balance.mutatiesVoorlopig,
          totaal: balance.totaal,
          totaalVoorlopig: balance.totaalVoorlopig,
          datums: balance.mutatieDatums ?? [],
          datumsVoorlopig: balance.mutatieDatumsVoorlopig ?? [],
        })),
      });
    } finally {
      setDownloading(false);
    }
  }

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
        {/*
          De knop staat naast het jaar, want dat is samen met de deelnemer wat er in het bestand
          komt. Uit zolang er geen balans geladen is; een leeg bestand ziet eruit als een fout.
        */}
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={loading || downloading || balances.length === 0}
          className="inline-flex h-9 items-center gap-2 rounded border bg-background px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          title={
            balances.length === 0
              ? 'Niets te exporteren'
              : 'Download deze absentietelling als Excel-bestand'
          }
        >
          <Download className="size-4" aria-hidden />
          Download Excel
        </button>
        {data.isManager && saving ? (
          <span className="text-sm text-muted-foreground">Opslaan…</span>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Balans laden…</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Afwezigheidstype</th>
              <th className="p-3 text-right">Beginsaldo</th>
              <th className="p-3 text-right">Budget</th>
              <th className="p-3 text-right">Mutaties</th>
              <th className="p-3 text-right">Mutaties?</th>
              <th className="p-3 text-right">Resterend</th>
              <th className="p-3 text-right">Resterend?</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((balance, index) => (
              <tr key={balance.absenceType.id} className="border-t">
                <td className="p-3">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <AbsenceDaypartCell absence={balance.absenceType} />
                    {balance.absenceType.naam}
                  </span>
                </td>
                {(['beginsaldo', 'budget'] as const).map((key) => (
                  <td key={key} className="p-3 text-right">
                    {data.isManager ? (
                      <input
                        type="number"
                        value={balance[key]}
                        min={0}
                        onChange={(event) => updateBalance(index, key, event.target.value)}
                        className="h-8 w-20 rounded border bg-background px-2 text-right"
                      />
                    ) : (
                      balance[key]
                    )}
                  </td>
                ))}
                <td className="p-3 text-right">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {balance.mutaties}
                    <MutationDatesDropdown datums={balance.mutatieDatums ?? []} />
                  </span>
                </td>
                <td className="p-3 text-right">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {balance.mutatiesVoorlopig}
                    <MutationDatesDropdown datums={balance.mutatieDatumsVoorlopig ?? []} />
                  </span>
                </td>
                <td className="p-3 text-right font-semibold">{balance.totaal}</td>
                <td className="p-3 text-right font-semibold">{balance.totaalVoorlopig}</td>
              </tr>
            ))}
            {balances.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
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
    </div>
  );
}

export default function DokterAfwezigheidPage() {
  return (
    <>
      <Head>
        <title>Absentie telling | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage
        title="Absentie telling"
      >
        {(context) => <DoctorAbsenceContent {...context} />}
      </PraktijkplannerPage>
    </>
  );
}
