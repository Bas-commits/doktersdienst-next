'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { DaypartIcon } from '@/components/praktijkplanner/DaypartIcon';
import {
  halfIngevuldeDagdelen,
  normaliseerTijd,
  tijdenPerDagdeel,
  volledigIngevuldeTijden,
} from '@/lib/praktijkplanner/daypart-times';
import type { PraktijkplannerDaypart, PraktijkplannerDaypartTime } from '@/types/praktijkplanner';

/**
 * Begin- en eindtijd per dagdeel, voor de hele waarneemgroep.
 *
 * De tijden staan niet per weekdag. Een groep die op zaterdag een andere ochtend heeft dan op
 * maandag kan dat hier niet zeggen; dat was de keuze bij deze kaart, omdat vier regels invullen
 * iets is wat een secretaris doet en achtentwintig niet.
 */
export function DaypartTimesEditor({
  groupId,
  dayparts,
  daypartTimes,
  onSaved,
}: {
  groupId: number;
  dayparts: PraktijkplannerDaypart[];
  daypartTimes: PraktijkplannerDaypartTime[];
  onSaved: (next: PraktijkplannerDaypartTime[]) => void;
}) {
  const orderedDayparts = useMemo(
    () => [...dayparts].sort((a, b) => a.volgorde - b.volgorde),
    [dayparts]
  );

  const [regels, setRegels] = useState(() => tijdenPerDagdeel(orderedDayparts, daypartTimes));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRegels(tijdenPerDagdeel(orderedDayparts, daypartTimes));
  }, [orderedDayparts, daypartTimes]);

  const halve = useMemo(() => new Set(halfIngevuldeDagdelen(regels)), [regels]);

  const zet = (iddagdeel: number, veld: 'begintijd' | 'eindtijd', waarde: string) => {
    setRegels((current) =>
      current.map((regel) => (regel.iddagdeel === iddagdeel ? { ...regel, [veld]: waarde } : regel))
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/praktijkplanner/dagdelen/tijden', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          times: volledigIngevuldeTijden(regels),
        }),
      });
      const payload = (await response.json()) as {
        daypartTimes?: PraktijkplannerDaypartTime[];
        error?: string;
      };
      if (!response.ok || !payload.daypartTimes) {
        throw new Error(payload.error || 'Opslaan mislukt.');
      }
      onSaved(payload.daypartTimes);
      toast.success('Tijden opgeslagen.');
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
          <h2 className="text-base font-semibold text-foreground">Tijden per dagdeel</h2>
          <p className="text-sm text-muted-foreground">
            Vul in hoe laat een dagdeel begint en eindigt. Leeg laten mag: het dagdeel werkt dan
            zoals nu, zonder tijd.
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

      <div className="grid gap-3 sm:grid-cols-2">
        {orderedDayparts.map((daypart) => {
          const regel = regels.find((item) => item.iddagdeel === daypart.id);
          const half = halve.has(daypart.id);
          return (
            <div
              key={daypart.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border/80 bg-background px-3 py-2"
            >
              <DaypartIcon volgorde={daypart.volgorde} maatPx={24} className="size-6" />
              <span className="min-w-24 text-sm font-medium text-foreground">{daypart.naam}</span>
              <input
                type="time"
                aria-label={`Begintijd ${daypart.naam}`}
                value={regel?.begintijd ?? ''}
                onChange={(event) => zet(daypart.id, 'begintijd', event.target.value)}
                className="rounded border border-border/80 bg-background px-2 py-1 text-sm text-foreground"
              />
              <span className="text-sm text-muted-foreground">tot</span>
              <input
                type="time"
                aria-label={`Eindtijd ${daypart.naam}`}
                value={regel?.eindtijd ?? ''}
                onChange={(event) => zet(daypart.id, 'eindtijd', event.target.value)}
                className="rounded border border-border/80 bg-background px-2 py-1 text-sm text-foreground"
              />
              {half ? (
                <span className="w-full text-xs text-[#c91b23]">
                  Alleen een begintijd of alleen een eindtijd wordt niet bewaard.
                </span>
              ) : null}
              {!half && regel && overMiddernacht(regel.begintijd, regel.eindtijd) ? (
                <span className="w-full text-xs text-muted-foreground">Loopt door tot de volgende dag.</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Of het dagdeel over middernacht heen gaat, zoals een nacht van 23:00 tot 07:00.
 *
 * Dat is geen fout en wordt ook niet geweigerd, maar wel gemeld: 23:00 tot 07:00 kan er ook
 * uitzien als een vergissing, en dan wil je zien dat het scherm het als nacht heeft begrepen.
 */
function overMiddernacht(begintijd: string, eindtijd: string): boolean {
  const begin = normaliseerTijd(begintijd);
  const eind = normaliseerTijd(eindtijd);
  if (!begin || !eind) return false;
  return eind < begin;
}
