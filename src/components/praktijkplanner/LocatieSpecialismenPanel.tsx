'use client';

import { useMemo, useState } from 'react';
import { CapacityLocatieKeuze } from './CapacityOverview';
import { CapacityWeekGrid } from './CapacityWeekGrid';
import { useHuidigMoment } from '@/hooks/praktijkplanner/useHuidigMoment';
import { addDays } from '@/lib/praktijkplanner/dates';
import {
  dagdelenZonderRooster,
  isDaypartSchedulable,
  weekdagenZonderRooster,
} from '@/lib/praktijkplanner/schedulable-dayparts';
import type { PraktijkplannerContextData } from '@/hooks/praktijkplanner/usePraktijkplannerContext';
import type { PraktijkplannerPlanningSlot } from '@/types/praktijkplanner';

type Telling = { label: string; aantal: number };

type DagdeelTelling = {
  deelnemers: number;
  expertises: Telling[];
  specificaties: Telling[];
};

/** Van naam naar aantal, gesorteerd op aantal en dan alfabetisch, zodat de volgorde vaststaat. */
function telOp(teller: Map<string, number>): Telling[] {
  return [...teller]
    .map(([label, aantal]) => ({ label, aantal }))
    .sort((links, rechts) => rechts.aantal - links.aantal || links.label.localeCompare(rechts.label));
}

/** Het aantal naast een naam. Geen kleur: er valt hier niets goed of fout te zijn. */
function AantalBadge({ aantal }: { aantal: number }) {
  return (
    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-border">
      {aantal}
    </span>
  );
}

function TellingLijst({ telling }: { telling: DagdeelTelling }) {
  const secties = [
    { key: 'expertises', title: 'Expertises', items: telling.expertises },
    { key: 'specificaties', title: 'Specificaties', items: telling.specificaties },
  ];
  return (
    <div className="min-w-[140px] space-y-1.5 text-xs">
      <div className="flex items-center justify-between gap-2 font-medium">
        <span>Aantal dokters:</span>
        <AantalBadge aantal={telling.deelnemers} />
      </div>
      {secties.map((sectie) =>
        sectie.items.length === 0 ? null : (
          <div key={sectie.key} className="space-y-1 border-t border-border/60 pt-1.5">
            <p className="font-semibold text-muted-foreground">{sectie.title}</p>
            {sectie.items.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2">
                <span className="truncate" title={item.label}>
                  {item.label}
                </span>
                <AantalBadge aantal={item.aantal} />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

/**
 * Welke specialismen er deze week op een locatie staan, per dagdeel geteld.
 *
 * Het capaciteitsoverzicht ernaast beantwoordt een andere vraag. Dat toont alleen wat er als
 * eis in een capaciteitsjabloon staat, met gepland tegenover benodigd; een expertise die wel
 * op de locatie loopt maar nergens geeist wordt komt daar niet voor. Dit paneel telt wat er
 * werkelijk staat, eis of niet, en dat is precies waarvoor het gevraagd is: zien welke
 * specialismen er allemaal op een locatie zijn.
 *
 * De telling komt uit dezelfde planning die links in het rooster staat, niet uit een eigen
 * ophaalactie. Zo kan het paneel niet iets anders beweren dan wat de planner ernaast ziet.
 * Alleen om te kijken; er valt niets te wijzigen.
 *
 * Args:
 *     isAfwezig: Een dagdeel waarop de deelnemer afwezig is telt niet mee. Zonder dat telt een
 *         dokter met vakantie gewoon door en lijkt de locatie voller dan hij is.
 */
export function LocatieSpecialismenPanel({
  data,
  weekStart,
  slots,
  isAfwezig,
}: {
  data: PraktijkplannerContextData;
  weekStart: string;
  slots: PraktijkplannerPlanningSlot[];
  isAfwezig: (iddeelnemer: number, datum: string, iddagdeel: number) => boolean;
}) {
  const [locationId, setLocationId] = useState<number | null>(null);
  const effectiveLocationId = locationId ?? data.masterData.locations[0]?.id ?? null;
  const huidigMoment = useHuidigMoment();

  const verborgenWeekdagen = useMemo(
    () => weekdagenZonderRooster(data.masterData.schedulableDayparts ?? []),
    [data.masterData.schedulableDayparts]
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

  const expertisesPerDeelnemer = useMemo(
    () => new Map(data.participants.map((deelnemer) => [deelnemer.id, deelnemer.expertises ?? []])),
    [data.participants]
  );

  const tellingen = useMemo(() => {
    const perDagdeel = new Map<string, DagdeelTelling>();
    const expertiseTellers = new Map<string, Map<string, number>>();
    const specificatieTellers = new Map<string, Map<string, number>>();

    for (const slot of slots) {
      if (slot.idplannerlocatie !== effectiveLocationId) continue;
      if (isAfwezig(slot.iddeelnemer, slot.datum, slot.iddagdeel)) continue;

      const sleutel = `${slot.datum}:${slot.iddagdeel}`;
      const bestaand = perDagdeel.get(sleutel) ?? { deelnemers: 0, expertises: [], specificaties: [] };
      perDagdeel.set(sleutel, { ...bestaand, deelnemers: bestaand.deelnemers + 1 });

      const expertises = expertiseTellers.get(sleutel) ?? new Map<string, number>();
      for (const expertise of expertisesPerDeelnemer.get(slot.iddeelnemer) ?? []) {
        const label = expertise.afkorting || expertise.naam;
        expertises.set(label, (expertises.get(label) ?? 0) + 1);
      }
      expertiseTellers.set(sleutel, expertises);

      if (slot.specification) {
        const specificaties = specificatieTellers.get(sleutel) ?? new Map<string, number>();
        const label = slot.specification.afkorting || slot.specification.naam;
        specificaties.set(label, (specificaties.get(label) ?? 0) + 1);
        specificatieTellers.set(sleutel, specificaties);
      }
    }

    for (const [sleutel, telling] of perDagdeel) {
      perDagdeel.set(sleutel, {
        ...telling,
        expertises: telOp(expertiseTellers.get(sleutel) ?? new Map()),
        specificaties: telOp(specificatieTellers.get(sleutel) ?? new Map()),
      });
    }
    return perDagdeel;
  }, [effectiveLocationId, expertisesPerDeelnemer, isAfwezig, slots]);

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
          {new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }).format(
            new Date(`${datum}T12:00:00`)
          )}
        </span>
      )),
    [huidigMoment?.datum, weekDates]
  );

  if (data.masterData.locations.length === 0) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        Voeg eerst een plannerlocatie toe in Plannerbeheer.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <CapacityLocatieKeuze
        locations={data.masterData.locations}
        value={effectiveLocationId}
        onChange={setLocationId}
        compact
      />
      {/*
        Het rooster scrollt binnen het paneel, niet de pagina eromheen. Anders schuift het
        weekrooster links mee omhoog zodra je hier naar de avond kijkt.
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
            const telling = tellingen.get(`${datum}:${daypart.id}`) ?? {
              deelnemers: 0,
              expertises: [],
              specificaties: [],
            };
            return <TellingLijst telling={telling} />;
          }}
        />
      </div>
    </div>
  );
}
