'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays } from '@/lib/praktijkplanner/dates';
import { deelnemerChipInitials } from '@/lib/deelnemer-display';
import { groepPlantDiensten } from '@/lib/praktijkplanner/diensten-in-groep';
import {
  isDaypartSchedulableForParticipant,
  participantMatrixFor,
} from '@/lib/praktijkplanner/schedulable-dayparts';
import { AbsenceDaypartCell } from './AbsenceDaypartCell';
import { PlannerDaypartGrid } from './PlannerDaypartGrid';
import { PlannerDienstvoorkeurMark } from './PlannerDienstvoorkeurMark';
import type { PraktijkplannerContextData } from '@/hooks/praktijkplanner/usePraktijkplannerContext';
import type {
  PraktijkplannerAbsenceSlot,
  PraktijkplannerDaypart,
  PraktijkplannerDienstvoorkeur,
  PraktijkplannerParticipant,
} from '@/types/praktijkplanner';

function keyFor(iddeelnemer: number, datum: string, iddagdeel: number) {
  return `${iddeelnemer}:${datum}:${iddagdeel}`;
}

/**
 * Wie voor deze week afwezig is of een dienst graag/liever niet wil, naast de week.
 *
 * Dit is bewust hetzelfde beeld als de Afwezigheidsplanner - dezelfde vakjes
 * (AbsenceDaypartCell), dezelfde dienstvoorkeur-tekens - in plaats van een eigen, vereenvoudigde
 * samenvatting. Een planner die hier "iemand is er niet" wil zien wil de afwezigheid zelf zien,
 * niet een aparte telling ernaast die toch weer net iets anders oogt.
 *
 * Alleen om te kijken: PlannerDaypartGrid krijgt bewust geen onCellClick, waarmee elk vakje
 * vanzelf niet-klikbaar wordt (zie de `disabled`-afleiding daar). Wijzigen blijft het werk van
 * de Afwezigheidsplanner, waar de voorkeur en de afwezigheid ook vandaan komen.
 *
 * Eigen ophaalacties in plaats van een prop met slots: dit paneel is de enige plek in de
 * Activiteiten planner die afwezigheden en dienstvoorkeuren nodig heeft.
 */
export function VoorkeurenPanel({
  groupId,
  data,
  weekStart,
  dayparts,
  verborgenWeekdagen,
}: {
  groupId: number;
  data: PraktijkplannerContextData;
  weekStart: string;
  dayparts: PraktijkplannerDaypart[];
  verborgenWeekdagen: ReadonlySet<number>;
}) {
  const [slots, setSlots] = useState<PraktijkplannerAbsenceSlot[]>([]);
  const [voorkeuren, setVoorkeuren] = useState<PraktijkplannerDienstvoorkeur[]>([]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  // Dezelfde afleiding als op de Afwezigheidsplanner: een groep die geen diensten plant heeft
  // ook geen dienstvoorkeuren om op te halen of te tonen.
  const heeftDienstTaken = useMemo(
    () => groepPlantDiensten(data.masterData.tasks),
    [data.masterData.tasks]
  );

  useEffect(() => {
    const abortController = new AbortController();
    fetch(
      `/api/praktijkplanner/afwezigheden?idwaarneemgroep=${groupId}&start=${weekStart}&end=${weekEnd}`,
      { credentials: 'include', signal: abortController.signal }
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          slots?: PraktijkplannerAbsenceSlot[];
          error?: string;
        };
        if (!response.ok || !payload.slots) {
          throw new Error(payload.error || 'Afwezigheden konden niet worden geladen.');
        }
        setSlots(payload.slots);
      })
      .catch(() => undefined);
    return () => abortController.abort();
  }, [groupId, weekStart, weekEnd]);

  useEffect(() => {
    if (!heeftDienstTaken) {
      setVoorkeuren([]);
      return;
    }
    const abortController = new AbortController();
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
      .catch(() => undefined);
    return () => abortController.abort();
  }, [groupId, heeftDienstTaken, weekStart, weekEnd]);

  const slotMap = useMemo(
    () => new Map(slots.map((slot) => [keyFor(slot.iddeelnemer, slot.datum, slot.iddagdeel), slot])),
    [slots]
  );
  const voorkeurMap = useMemo(
    () =>
      new Map(
        voorkeuren.map((voorkeur) => [
          keyFor(voorkeur.iddeelnemer, voorkeur.datum, voorkeur.iddagdeel),
          voorkeur,
        ])
      ),
    [voorkeuren]
  );

  const isCellFilled = useCallback(
    (iddeelnemer: number, datum: string, iddagdeel: number) =>
      slotMap.has(keyFor(iddeelnemer, datum, iddagdeel)) ||
      voorkeurMap.has(keyFor(iddeelnemer, datum, iddagdeel)),
    [slotMap, voorkeurMap]
  );

  const renderCell = useCallback(
    (participant: PraktijkplannerParticipant, datum: string, daypart: PraktijkplannerDaypart) => {
      const sleutel = keyFor(participant.id, datum, daypart.id);
      const slot = slotMap.get(sleutel);
      const voorkeur = voorkeurMap.get(sleutel) ?? null;
      if (!slot && !voorkeur) return null;

      // Allebei tegelijk kan: een dagdeel met vakantie waarop de dokter toch graag dienst doet.
      // De afwezigheid houdt dan het vlak en de voorkeur wordt een hoekje, net als op de
      // Afwezigheidsplanner - zie PlannerDienstvoorkeurMark voor waarom dat de afspraak is.
      if (slot) {
        return (
          <div className="relative h-full w-full">
            <AbsenceDaypartCell
              absence={slot.absenceType}
              provisional={slot.isVoorlopig}
              participantInitials={deelnemerChipInitials(participant)}
              participantColor={participant.color}
              fill
            />
            {voorkeur ? (
              <PlannerDienstvoorkeurMark
                voorkeur={voorkeur.voorkeur}
                aangevraagd={voorkeur.isVoorlopig}
                variant="hoek"
              />
            ) : null}
          </div>
        );
      }
      return voorkeur ? (
        <PlannerDienstvoorkeurMark voorkeur={voorkeur.voorkeur} aangevraagd={voorkeur.isVoorlopig} />
      ) : null;
    },
    [slotMap, voorkeurMap]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PlannerDaypartGrid
          participants={data.participants}
          dayparts={dayparts}
          weekStart={weekStart}
          verborgenWeekdagen={verborgenWeekdagen}
          toonInhoudOpNietInplanbaar
          renderCell={({ participant, datum, daypart }) => renderCell(participant, datum, daypart)}
          daypartTimes={data.masterData.daypartTimes ?? []}
          isCellFilled={({ participant, datum, daypart }) =>
            isCellFilled(participant.id, datum, daypart.id)
          }
          isCellUnavailable={({ participant, datum, daypart }) =>
            !isDaypartSchedulableForParticipant(
              data.masterData.schedulableDayparts ?? [],
              participantMatrixFor(data.masterData.participantSchedulableDayparts ?? [], participant.id),
              datum,
              daypart.id
            )
          }
        />
      </div>
    </div>
  );
}
