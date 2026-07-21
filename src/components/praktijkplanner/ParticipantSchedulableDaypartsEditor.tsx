'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { CAPACITY_WEEKDAYS } from '@/components/praktijkplanner/CapacityWeekGrid';
import {
  participantMatrixFor,
  resolveParticipantMatrixForEditor,
  resolveSchedulableMatrixForEditor,
  schedulableCellKey,
} from '@/lib/praktijkplanner/schedulable-dayparts';
import { cn } from '@/lib/utils';
import type {
  PraktijkplannerDaypart,
  PraktijkplannerParticipant,
  PraktijkplannerParticipantSchedulableDaypart,
  PraktijkplannerSchedulableDaypart,
} from '@/types/praktijkplanner';

const DAYPART_ICONS: Record<number, { gray: string; green: string }> = {
  1: { gray: '/icons/sunrise.svg', green: '/images/icons/sunrise-green.svg' },
  2: { gray: '/icons/sunset.svg', green: '/images/icons/sunset-green.svg' },
  3: { gray: '/icons/moon-down.svg', green: '/images/icons/moon-down-green.svg' },
  4: { gray: '/icons/moon-up.svg', green: '/images/icons/moon-up-green.svg' },
};

function participantLabel(participant: PraktijkplannerParticipant): string {
  return (
    [participant.voornaam, participant.achternaam].filter(Boolean).join(' ') ||
    participant.name ||
    participant.initialen ||
    `Deelnemer ${participant.id}`
  );
}

export function ParticipantSchedulableDaypartsEditor({
  groupId,
  participants,
  dayparts,
  groupSchedulableDayparts,
  participantSchedulableDayparts,
  onSaved,
}: {
  groupId: number;
  participants: PraktijkplannerParticipant[];
  dayparts: PraktijkplannerDaypart[];
  groupSchedulableDayparts: PraktijkplannerSchedulableDaypart[];
  participantSchedulableDayparts: PraktijkplannerParticipantSchedulableDaypart[];
  onSaved: (iddeelnemer: number, next: PraktijkplannerParticipantSchedulableDaypart[]) => void;
}) {
  const orderedDayparts = useMemo(
    () => [...dayparts].sort((a, b) => a.volgorde - b.volgorde),
    [dayparts]
  );
  const daypartIds = useMemo(() => orderedDayparts.map((d) => d.id), [orderedDayparts]);
  const groupResolved = useMemo(
    () => resolveSchedulableMatrixForEditor(groupSchedulableDayparts, daypartIds),
    [groupSchedulableDayparts, daypartIds]
  );
  const groupActiveByKey = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const cell of groupResolved) {
      map.set(schedulableCellKey(cell.weekdag, cell.iddagdeel), cell.actief);
    }
    return map;
  }, [groupResolved]);

  const customizedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of participantSchedulableDayparts) ids.add(row.iddeelnemer);
    return ids;
  }, [participantSchedulableDayparts]);

  const sortedParticipants = useMemo(
    () =>
      [...participants].sort((a, b) =>
        participantLabel(a).localeCompare(participantLabel(b), 'nl', { sensitivity: 'base' })
      ),
    [participants]
  );

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [matrix, setMatrix] = useState<PraktijkplannerSchedulableDaypart[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedId == null) {
      setMatrix([]);
      return;
    }
    setMatrix(
      resolveParticipantMatrixForEditor(
        groupResolved,
        participantMatrixFor(participantSchedulableDayparts, selectedId),
        daypartIds
      )
    );
  }, [selectedId, groupResolved, participantSchedulableDayparts, daypartIds]);

  const activeByKey = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const cell of matrix) {
      map.set(schedulableCellKey(cell.weekdag, cell.iddagdeel), cell.actief);
    }
    return map;
  }, [matrix]);

  const selectedParticipant = sortedParticipants.find((p) => p.id === selectedId) ?? null;

  const toggle = (weekdag: number, iddagdeel: number) => {
    if (groupActiveByKey.get(schedulableCellKey(weekdag, iddagdeel)) !== true) return;
    setMatrix((current) =>
      current.map((cell) =>
        cell.weekdag === weekdag && cell.iddagdeel === iddagdeel
          ? { ...cell, actief: !cell.actief }
          : cell
      )
    );
  };

  const resetToGroup = async () => {
    if (selectedId == null) return;
    setSaving(true);
    try {
      const response = await fetch('/api/praktijkplanner/dagdelen/deelnemer', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          iddeelnemer: selectedId,
          clear: true,
        }),
      });
      const payload = (await response.json()) as {
        participantSchedulableDayparts?: PraktijkplannerParticipantSchedulableDaypart[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || 'Herstellen mislukt.');
      }
      onSaved(selectedId, payload.participantSchedulableDayparts ?? []);
      setMatrix(groupResolved.map((cell) => ({ ...cell })));
      toast.success('Deelnemer volgt weer de groepsinstelling.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Herstellen mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (selectedId == null) return;
    setSaving(true);
    try {
      const response = await fetch('/api/praktijkplanner/dagdelen/deelnemer', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          iddeelnemer: selectedId,
          cells: matrix,
        }),
      });
      const payload = (await response.json()) as {
        participantSchedulableDayparts?: PraktijkplannerParticipantSchedulableDaypart[];
        error?: string;
      };
      if (!response.ok || !payload.participantSchedulableDayparts) {
        throw new Error(payload.error || 'Opslaan mislukt.');
      }
      onSaved(selectedId, payload.participantSchedulableDayparts);
      toast.success('Beschikbaarheid deelnemer opgeslagen.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Beschikbaarheid per deelnemer</h2>
        <p className="text-sm text-muted-foreground">
          Beperk per deelnemer welke dagdelen inplanbaar zijn, binnen de mogelijkheden van de
          waarneemgroep. Zonder aanpassing geldt de groepsinstelling.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="border-b px-3 py-2 font-semibold">Deelnemer</th>
              <th className="border-b px-3 py-2 font-semibold">Instelling</th>
              <th className="border-b px-3 py-2 font-semibold">Actie</th>
            </tr>
          </thead>
          <tbody>
            {sortedParticipants.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-muted-foreground">
                  Geen deelnemers in deze waarneemgroep.
                </td>
              </tr>
            ) : (
              sortedParticipants.map((participant) => {
                const customized = customizedIds.has(participant.id);
                const selected = selectedId === participant.id;
                return (
                  <tr
                    key={participant.id}
                    className={cn('border-t', selected ? 'bg-muted/50' : 'hover:bg-muted/30')}
                  >
                    <td className="px-3 py-2 font-medium">{participantLabel(participant)}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {customized ? 'Aangepast' : 'Standaard (groep)'}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(participant.id)}
                        className={cn(
                          'rounded border px-2 py-1 text-xs font-medium hover:bg-background',
                          selected ? 'border-primary text-primary' : ''
                        )}
                      >
                        {selected ? 'Geselecteerd' : 'Bewerken'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedParticipant ? (
        <div className="mt-4 space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">{participantLabel(selectedParticipant)}</h3>
              <p className="text-xs text-muted-foreground">
                Grijze vakken zijn uitgeschakeld voor de waarneemgroep en kunnen niet worden
                geactiveerd.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetToGroup}
                className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-sm hover:bg-background"
              >
                <RotateCcw className="size-3.5" /> Herstel groep
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                <Save className="size-3.5" /> {saving ? 'Opslaan…' : 'Opslaan'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="inline-flex min-w-full gap-0 divide-x divide-border/70">
              {CAPACITY_WEEKDAYS.map((weekday) => (
                <div
                  key={weekday.id}
                  className="flex min-w-[7.5rem] flex-1 flex-col items-center gap-2 px-3 py-1"
                >
                  <span className="text-sm font-medium text-foreground">{weekday.label}</span>
                  <div className="grid grid-cols-2 gap-1.5 rounded-md border border-border/80 bg-background p-1.5">
                    {orderedDayparts.map((daypart) => {
                      const key = schedulableCellKey(weekday.id, daypart.id);
                      const groupAllowed = groupActiveByKey.get(key) === true;
                      const active = groupAllowed && activeByKey.get(key) === true;
                      const icons = DAYPART_ICONS[daypart.volgorde];
                      return (
                        <button
                          key={daypart.id}
                          type="button"
                          title={`${weekday.label} ${daypart.naam}${groupAllowed ? '' : ' (niet in groep)'}`}
                          aria-pressed={active}
                          disabled={!groupAllowed}
                          onClick={() => toggle(weekday.id, daypart.id)}
                          className={cn(
                            'flex size-11 items-center justify-center rounded border transition-colors',
                            !groupAllowed
                              ? 'cursor-not-allowed border-border/40 bg-muted/30 opacity-40'
                              : active
                                ? 'border-[#7bc46a] bg-[#e8f6e4]'
                                : 'border-border/70 bg-muted/40 opacity-70'
                          )}
                        >
                          {icons ? (
                            <Image
                              src={active ? icons.green : icons.gray}
                              alt=""
                              width={28}
                              height={28}
                              className="size-7"
                            />
                          ) : (
                            <span className="text-[10px]">{daypart.naam.slice(0, 2)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
