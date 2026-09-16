'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  metVerborgenWeekend,
  useWeekendVerbergen,
} from '@/hooks/praktijkplanner/useWeekendVerbergen';
import { useHuidigMoment } from '@/hooks/praktijkplanner/useHuidigMoment';
import { addDays } from '@/lib/praktijkplanner/dates';
import { deelnemerRoosterNaam } from '@/lib/deelnemer-display';
import {
  dagdelenZonderRooster,
  isDaypartSchedulable,
  weekdagenZonderRooster,
} from '@/lib/praktijkplanner/schedulable-dayparts';
import { CapacityWeekGrid } from './CapacityWeekGrid';
import { dienstvoorkeurKleur, dienstvoorkeurLabel } from './PlannerDienstvoorkeurMark';
import type { PraktijkplannerContextData } from '@/hooks/praktijkplanner/usePraktijkplannerContext';
import type { PraktijkplannerDienstvoorkeur } from '@/types/praktijkplanner';

type VoorkeurRij = {
  naam: string;
  voorkeur: PraktijkplannerDienstvoorkeur['voorkeur'];
  isVoorlopig: boolean;
};

/**
 * Wie voor deze week een dienst graag of liever niet wil, per dagdeel naast elkaar.
 *
 * De voorkeuren zelf worden vastgelegd op het dagdeel in de Afwezigheidsplanner, niet hier: dit
 * paneel is alleen om te kijken, zodat de planner ze kan meewegen terwijl hij plant zonder heen
 * en weer te schakelen tussen twee schermen. Zie ExpertisePanel voor hetzelfde idee met
 * expertises in plaats van voorkeuren.
 *
 * Eigen ophaalactie in plaats van een prop met slots: voorkeuren horen niet bij de planning die
 * al in het rooster hangt, en dit paneel is de enige plek in de Activiteiten planner die ze
 * nodig heeft.
 */
export function VoorkeurenPanel({
  groupId,
  data,
  weekStart,
}: {
  groupId: number;
  data: PraktijkplannerContextData;
  weekStart: string;
}) {
  const [voorkeuren, setVoorkeuren] = useState<PraktijkplannerDienstvoorkeur[]>([]);
  const [loading, setLoading] = useState(false);
  const huidigMoment = useHuidigMoment();
  const { weekendVerborgen } = useWeekendVerbergen();
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  useEffect(() => {
    const abortController = new AbortController();
    setLoading(true);
    fetch(
      `/api/praktijkplanner/dienstvoorkeuren?idwaarneemgroep=${groupId}&start=${weekStart}&end=${weekEnd}`,
      { credentials: 'include', signal: abortController.signal }
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          voorkeuren?: PraktijkplannerDienstvoorkeur[];
          error?: string;
        };
        if (!response.ok || !payload.voorkeuren) {
          throw new Error(payload.error || 'De dienstvoorkeuren konden niet worden geladen.');
        }
        setVoorkeuren(payload.voorkeuren);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => abortController.abort();
  }, [groupId, weekStart, weekEnd]);

  const naamPerDeelnemer = useMemo(
    () =>
      new Map(
        data.participants.map((deelnemer) => [deelnemer.id, deelnemerRoosterNaam(deelnemer)])
      ),
    [data.participants]
  );

  const perDagdeel = useMemo(() => {
    const kaart = new Map<string, VoorkeurRij[]>();
    for (const voorkeur of voorkeuren) {
      const naam = naamPerDeelnemer.get(voorkeur.iddeelnemer);
      if (!naam) continue; // Niet meer in deze groep; de rij blijft gewoon weg.
      const sleutel = `${voorkeur.datum}:${voorkeur.iddagdeel}`;
      const rijen = kaart.get(sleutel) ?? [];
      rijen.push({ naam, voorkeur: voorkeur.voorkeur, isVoorlopig: voorkeur.isVoorlopig });
      kaart.set(sleutel, rijen);
    }
    for (const rijen of kaart.values()) {
      rijen.sort((links, rechts) => links.naam.localeCompare(rechts.naam));
    }
    return kaart;
  }, [voorkeuren, naamPerDeelnemer]);

  const verborgenWeekdagen = useMemo(
    () =>
      metVerborgenWeekend(
        weekdagenZonderRooster(data.masterData.schedulableDayparts ?? []),
        weekendVerborgen
      ),
    [data.masterData.schedulableDayparts, weekendVerborgen]
  );
  const dayparts = useMemo(() => {
    const weg = dagdelenZonderRooster(
      data.masterData.schedulableDayparts ?? [],
      data.masterData.dayparts.map((daypart) => daypart.id)
    );
    return [...data.masterData.dayparts]
      .filter((daypart) => !weg.has(daypart.id))
      .sort((links, rechts) => links.volgorde - rechts.volgorde);
  }, [data.masterData.dayparts, data.masterData.schedulableDayparts]);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const weekdayHeaders = useMemo(
    () =>
      weekDates.map((datum) => (
        <span
          key={datum}
          className={
            datum === huidigMoment?.datum
              ? 'block normal-case tracking-normal text-emerald-600'
              : 'block normal-case tracking-normal'
          }
        >
          {new Intl.DateTimeFormat('nl-NL', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }).format(new Date(`${datum}T12:00:00`))}
        </span>
      )),
    [huidigMoment?.datum, weekDates]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {loading && voorkeuren.length === 0 ? (
        <p className="text-xs text-muted-foreground">Bezig met laden...</p>
      ) : null}
      {/*
        Het rooster scrollt binnen het paneel, niet de pagina eromheen. Zelfde reden als bij
        ExpertisePanel: anders schuift het weekrooster links mee omhoog.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CapacityWeekGrid
          dayparts={dayparts}
          weekdayHeaders={weekdayHeaders}
          verborgenWeekdagen={verborgenWeekdagen}
          isCellUnavailable={(weekday, daypart) =>
            !isDaypartSchedulable(data.masterData.schedulableDayparts ?? [], weekday.id, daypart.id)
          }
          isCurrentCell={(weekday, daypart) =>
            weekDates[weekday.id - 1] === huidigMoment?.datum &&
            daypart.volgorde === huidigMoment.volgorde
          }
          renderCell={(weekday, daypart) => {
            const datum = weekDates[weekday.id - 1];
            const rijen = perDagdeel.get(`${datum}:${daypart.id}`) ?? [];
            if (rijen.length === 0) return null;
            return (
              <div className="space-y-1 text-xs">
                {rijen.map((rij, index) => (
                  <div
                    key={`${rij.naam}:${index}`}
                    className="flex items-center gap-1.5"
                    title={dienstvoorkeurLabel(rij.voorkeur, rij.isVoorlopig)}
                  >
                    <span
                      className={[
                        'inline-block size-2 shrink-0 rounded-full',
                        rij.isVoorlopig ? 'border border-dashed border-current' : '',
                      ].join(' ')}
                      style={{ background: dienstvoorkeurKleur(rij.voorkeur, rij.isVoorlopig) }}
                    />
                    <span className="truncate">{rij.naam}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
