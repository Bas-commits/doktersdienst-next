'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CapacityLocatieKeuze } from './CapacityOverview';
import { CapacityWeekGrid } from './CapacityWeekGrid';
import { useHuidigMoment } from '@/hooks/praktijkplanner/useHuidigMoment';
import { addDays } from '@/lib/praktijkplanner/dates';
import { isDaypartSchedulable, weekdagenZonderRooster } from '@/lib/praktijkplanner/schedulable-dayparts';
import type { PraktijkplannerContextData } from '@/hooks/praktijkplanner/usePraktijkplannerContext';
import type {
  PraktijkplannerDaypart,
  PraktijkplannerParticipant,
  PraktijkplannerPlanningSlot,
} from '@/types/praktijkplanner';

/**
 * Alles wat er deze week op een locatie staat, per dagdeel en per dag.
 *
 * Naast het rooster staat de week per dokter: elke regel een naam, en je leest af wat die
 * persoon doet. Deze vraag staat er haaks op. Iemand die naar een locatie kijkt wil weten wie
 * daar op woensdagochtend zijn, en dat is in het rooster alleen te vinden door zeven regels
 * langs te lopen en de locatie van elke fiche na te gaan.
 *
 * Dezelfde indeling als het paneel Expertise, dagdelen in de regels en dagen in de kolommen,
 * maar in het vakje staan de fiches zelf in plaats van tellingen. Zo lijken de twee panelen
 * op elkaar en hoeft niemand twee indelingen te leren.
 *
 * Alleen om te kijken. Plannen gaat per dokter, en dat is precies wat het rooster ernaast is.
 *
 * Args:
 *     renderSlot: De fiche zoals het rooster hem tekent, inclusief hoverkaart. Meegegeven en
 *         niet hier nagemaakt, want twee tekeningen van dezelfde fiche gaan uit elkaar lopen.
 *     dayparts: De dagdelen die op het scherm staan. Volgt de knop Avond en nacht, dus met
 *         die knop uit blijven ochtend en middag over en heeft het paneel twee regels.
 *     isAfwezig: Een vastgelegde afwezigheid haalt de dokter hier weg. Op een locatie gaat de
 *         vraag over wie er is; een palmboom in het vakje beantwoordt die niet. Een aanvraag
 *         is nog geen afwezigheid en blijft dus staan, grijs en met het vraagteken.
 */
export function LocatieFichesPanel({
  data,
  weekStart,
  slots,
  dayparts,
  isAfwezig,
  renderSlot,
}: {
  data: PraktijkplannerContextData;
  weekStart: string;
  slots: PraktijkplannerPlanningSlot[];
  dayparts: PraktijkplannerDaypart[];
  isAfwezig: (iddeelnemer: number, datum: string, iddagdeel: number) => boolean;
  renderSlot: (opties: {
    participant: PraktijkplannerParticipant;
    datum: string;
    daypart: { id: number; naam: string };
    hoverEnabled: boolean;
  }) => ReactNode;
}) {
  const [locationId, setLocationId] = useState<number | null>(null);
  const effectiveLocationId = locationId ?? data.masterData.locations[0]?.id ?? null;
  const huidigMoment = useHuidigMoment();

  const verborgenWeekdagen = useMemo(
    () => weekdagenZonderRooster(data.masterData.schedulableDayparts ?? []),
    [data.masterData.schedulableDayparts]
  );

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  const deelnemerPerId = useMemo(
    () => new Map(data.participants.map((deelnemer) => [deelnemer.id, deelnemer])),
    [data.participants]
  );

  /*
    Per dagdeel de dokters die er op deze locatie staan, in de volgorde van het rooster
    ernaast. Een eigen sortering zou betekenen dat dezelfde week hier een andere volgorde
    heeft dan links, en dan gaat iemand zoeken naar een verschil dat er niet is.
  */
  const perDagdeel = useMemo(() => {
    const volgorde = new Map(data.participants.map((deelnemer, index) => [deelnemer.id, index]));
    const gevonden = new Map<string, PraktijkplannerParticipant[]>();
    for (const slot of slots) {
      if (slot.idplannerlocatie !== effectiveLocationId) continue;
      if (isAfwezig(slot.iddeelnemer, slot.datum, slot.iddagdeel)) continue;
      const deelnemer = deelnemerPerId.get(slot.iddeelnemer);
      if (!deelnemer) continue;
      const sleutel = `${slot.datum}:${slot.iddagdeel}`;
      gevonden.set(sleutel, [...(gevonden.get(sleutel) ?? []), deelnemer]);
    }
    for (const [sleutel, deelnemers] of gevonden) {
      gevonden.set(
        sleutel,
        [...deelnemers].sort(
          (links, rechts) => (volgorde.get(links.id) ?? 0) - (volgorde.get(rechts.id) ?? 0)
        )
      );
    }
    return gevonden;
  }, [data.participants, deelnemerPerId, effectiveLocationId, isAfwezig, slots]);

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
        Het paneel scrollt van binnen, net als Expertise. Anders schuift het weekrooster links
        mee omhoog zodra je hier naar de avond kijkt.
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
            const deelnemers = perDagdeel.get(`${datum}:${daypart.id}`) ?? [];
            if (deelnemers.length === 0) return null;
            /*
              De fiches lopen door op een volgende regel en het vakje groeit mee. Een aantal
              tonen met de rest in de hoverkaart zou hier het ene ding weghalen waarvoor het
              paneel bestaat: in een oogopslag zien wie er staan. Een drukke locatie maakt de
              regel hoger, en dat is te overzien.
            */
            return (
              <div className="flex flex-wrap gap-1">
                {deelnemers.map((deelnemer) => (
                  <div key={deelnemer.id} className="size-14 shrink-0">
                    {renderSlot({ participant: deelnemer, datum, daypart, hoverEnabled: true })}
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
