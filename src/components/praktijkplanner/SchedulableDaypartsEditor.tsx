'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { CAPACITY_WEEKDAYS } from '@/components/praktijkplanner/CapacityWeekGrid';
import {
  resolveSchedulableMatrixForEditor,
} from '@/lib/praktijkplanner/schedulable-dayparts';
import { cn } from '@/lib/utils';
import type {
  PraktijkplannerDaypart,
  PraktijkplannerSchedulableDaypart,
} from '@/types/praktijkplanner';

const DAYPART_ICONS: Record<number, { gray: string; green: string }> = {
  1: { gray: '/icons/sunrise.svg', green: '/images/icons/sunrise-green.svg' },
  2: { gray: '/icons/sunset.svg', green: '/images/icons/sunset-green.svg' },
  3: { gray: '/icons/moon-down.svg', green: '/images/icons/moon-down-green.svg' },
  4: { gray: '/icons/moon-up.svg', green: '/images/icons/moon-up-green.svg' },
};

function cellKey(weekdag: number, iddagdeel: number): string {
  return `${weekdag}:${iddagdeel}`;
}

export function SchedulableDaypartsEditor({
  groupId,
  dayparts,
  schedulableDayparts,
  onSaved,
}: {
  groupId: number;
  dayparts: PraktijkplannerDaypart[];
  schedulableDayparts: PraktijkplannerSchedulableDaypart[];
  onSaved: (next: PraktijkplannerSchedulableDaypart[]) => void;
}) {
  const orderedDayparts = useMemo(
    () => [...dayparts].sort((a, b) => a.volgorde - b.volgorde),
    [dayparts]
  );
  const daypartIds = useMemo(() => orderedDayparts.map((d) => d.id), [orderedDayparts]);

  const [matrix, setMatrix] = useState<PraktijkplannerSchedulableDaypart[]>(() =>
    resolveSchedulableMatrixForEditor(schedulableDayparts, daypartIds)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMatrix(resolveSchedulableMatrixForEditor(schedulableDayparts, daypartIds));
  }, [schedulableDayparts, daypartIds]);

  const activeByKey = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const cell of matrix) {
      map.set(cellKey(cell.weekdag, cell.iddagdeel), cell.actief);
    }
    return map;
  }, [matrix]);

  const toggle = (weekdag: number, iddagdeel: number) => {
    setMatrix((current) =>
      current.map((cell) =>
        cell.weekdag === weekdag && cell.iddagdeel === iddagdeel
          ? { ...cell, actief: !cell.actief }
          : cell
      )
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/praktijkplanner/dagdelen', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          cells: matrix,
        }),
      });
      const payload = (await response.json()) as {
        schedulableDayparts?: PraktijkplannerSchedulableDaypart[];
        error?: string;
      };
      if (!response.ok || !payload.schedulableDayparts) {
        throw new Error(payload.error || 'Opslaan mislukt.');
      }
      onSaved(payload.schedulableDayparts);
      toast.success('Dagdelen opgeslagen.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border bg-muted/30 p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Dagdelen</h2>
          <p className="text-sm text-muted-foreground">
            Selecteer welke dagdelen inplanbaar zijn voor deze waarneemgroep.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <Save className="size-4" /> {saving ? 'Opslaan…' : 'Opslaan'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-0 divide-x divide-border/70">
          {CAPACITY_WEEKDAYS.map((weekday) => (
            <div key={weekday.id} className="flex min-w-[7.5rem] flex-1 flex-col items-center gap-2 px-3 py-1">
              <span className="text-sm font-medium text-foreground">{weekday.label}</span>
              <div className="grid grid-cols-2 gap-1.5 rounded-md border border-border/80 bg-background p-1.5">
                {orderedDayparts.map((daypart) => {
                  const active = activeByKey.get(cellKey(weekday.id, daypart.id)) === true;
                  const icons = DAYPART_ICONS[daypart.volgorde];
                  return (
                    <button
                      key={daypart.id}
                      type="button"
                      title={`${weekday.label} ${daypart.naam}`}
                      aria-pressed={active}
                      onClick={() => toggle(weekday.id, daypart.id)}
                      className={cn(
                        'flex size-11 items-center justify-center rounded border transition-colors',
                        active
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
    </section>
  );
}
