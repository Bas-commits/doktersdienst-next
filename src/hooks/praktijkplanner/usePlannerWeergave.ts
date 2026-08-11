'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatIsoDate, isIsoDate, startOfIsoWeek } from '@/lib/praktijkplanner/dates';

export type PlannerViewMode = 'week' | 'month';

export type PlannerWeergave = {
  weekStart: string;
  viewMode: PlannerViewMode;
};

/**
 * Eén kanaal voor alle roosterschermen. BroadcastChannel bereikt elk venster en elk tabblad
 * van hetzelfde adres, dus ook twee losse vensters op twee monitoren. Dat is hoe een planner
 * hier werkt: plannen op het ene scherm, capaciteit nakijken op het andere.
 */
const KANAAL_NAAM = 'praktijkplanner-weergave';

type WeergaveBericht = PlannerWeergave & { idwaarneemgroep: number };

function huidigeWeek() {
  return startOfIsoWeek(formatIsoDate(new Date()));
}

function isWeergaveBericht(value: unknown): value is WeergaveBericht {
  if (typeof value !== 'object' || value === null) return false;
  const bericht = value as Record<string, unknown>;
  return (
    typeof bericht.idwaarneemgroep === 'number' &&
    isIsoDate(bericht.weekStart) &&
    (bericht.viewMode === 'week' || bericht.viewMode === 'month')
  );
}

/**
 * De week en de weergave die alle open roosterschermen delen.
 *
 * Elk scherm hield dit in zijn eigen state, dus wie de Activiteiten planner en het Capaciteit
 * overzicht naast elkaar had staan vergeleek zonder het te merken twee verschillende weken.
 *
 * De maand zit hier niet in. Schermen leiden hun maand af van de week met maandVanWeek, zodat
 * week en maand niet uit elkaar kunnen lopen en er maar één ding rond hoeft te gaan.
 *
 * De keuze wordt niet bewaard: een scherm opent altijd op de huidige week, en pas daarna
 * volgen open schermen elkaar. Anders begin je een ochtend onbedoeld in een week van vorige
 * maand omdat je daar gisteren naar keek.
 *
 * Args:
 *     idwaarneemgroep: Berichten van een andere waarneemgroep worden genegeerd. Twee vensters
 *         op verschillende groepen mogen elkaar niet verzetten.
 */
export function usePlannerWeergave(idwaarneemgroep: number): PlannerWeergave & {
  setWeekStart: (weekStart: string) => void;
  setViewMode: (viewMode: PlannerViewMode) => void;
} {
  const [weergave, setWeergave] = useState<PlannerWeergave>(() => ({
    weekStart: huidigeWeek(),
    viewMode: 'week',
  }));
  const kanaal = useRef<BroadcastChannel | null>(null);
  // Wat er als laatste over het kanaal ging, in of uit. Zonder dit stuurt een scherm het
  // bericht dat het net ontving meteen weer terug en blijven twee schermen elkaar verzetten.
  const laatsteBericht = useRef<string | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(KANAAL_NAAM);
    kanaal.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isWeergaveBericht(event.data) || event.data.idwaarneemgroep !== idwaarneemgroep) {
        return;
      }
      const volgende: PlannerWeergave = {
        weekStart: event.data.weekStart,
        viewMode: event.data.viewMode,
      };
      laatsteBericht.current = JSON.stringify(volgende);
      setWeergave(volgende);
    };
    return () => {
      channel.close();
      kanaal.current = null;
    };
  }, [idwaarneemgroep]);

  useEffect(() => {
    const inhoud = JSON.stringify(weergave);
    if (laatsteBericht.current === null) {
      // Het openen van een scherm is geen keuze om iets te verzetten. Zou dit wel uitgezonden
      // worden, dan zette een nieuw tabblad alle andere schermen terug naar deze week.
      laatsteBericht.current = inhoud;
      return;
    }
    if (laatsteBericht.current === inhoud) return;
    laatsteBericht.current = inhoud;
    kanaal.current?.postMessage({ idwaarneemgroep, ...weergave } satisfies WeergaveBericht);
  }, [idwaarneemgroep, weergave]);

  const setWeekStart = useCallback((weekStart: string) => {
    setWeergave((huidig) => (huidig.weekStart === weekStart ? huidig : { ...huidig, weekStart }));
  }, []);

  const setViewMode = useCallback((viewMode: PlannerViewMode) => {
    setWeergave((huidig) => (huidig.viewMode === viewMode ? huidig : { ...huidig, viewMode }));
  }, []);

  return { ...weergave, setWeekStart, setViewMode };
}
