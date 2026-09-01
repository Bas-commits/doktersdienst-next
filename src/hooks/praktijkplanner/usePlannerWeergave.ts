'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatIsoDate, isIsoDate, startOfIsoWeek } from '@/lib/praktijkplanner/dates';

/**
 * Wat er naast de week staat.
 *
 * Links staat altijd de week, dus dit is geen keuze tussen twee weergaven maar de keuze wat
 * je erbij wil zien. Past het niet naast elkaar, dan komt het in de plaats van de week; dat
 * is precies wat de oude knop Maand deed. Zie useBeschikbareBreedte.
 */
export type PlannerNevenscherm = 'geen' | 'maand' | 'capaciteit' | 'expertise' | 'locatie';

const NEVENSCHERMEN: readonly PlannerNevenscherm[] = [
  'geen',
  'maand',
  'capaciteit',
  'expertise',
  'locatie',
];

export type PlannerWeergave = {
  weekStart: string;
  nevenscherm: PlannerNevenscherm;
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

/**
 * De week waar het vorige roosterscherm op stond, binnen dit tabblad.
 *
 * Van de Activiteiten planner naar de Afwezigheidsplanner klikken haalt het ene scherm weg en
 * zet het andere neer, dus de state van het eerste bestaat niet meer. Het kanaal helpt daar
 * niet: dat bereikt alleen schermen die op dat moment openstaan, en het scherm dat de week
 * kende is juist net verdwenen.
 *
 * Bewust een variabele in deze module en geen opslag in de browser. Hij leeft precies zolang
 * als de pagina in dit tabblad: navigeren binnen de app neemt de week mee, opnieuw laden begint
 * weer op de huidige week. Dat laatste is de keuze die hieronder staat en die blijft staan.
 *
 * Hij wordt ook nooit op de server gevuld, want effecten draaien daar niet. De server tekent
 * dus altijd de huidige week en de browser begint met dezelfde waarde.
 */
let laatsteWeek: { idwaarneemgroep: number; weekStart: string } | null = null;

function isWeergaveBericht(value: unknown): value is WeergaveBericht {
  if (typeof value !== 'object' || value === null) return false;
  const bericht = value as Record<string, unknown>;
  return (
    typeof bericht.idwaarneemgroep === 'number' &&
    isIsoDate(bericht.weekStart) &&
    NEVENSCHERMEN.includes(bericht.nevenscherm as PlannerNevenscherm)
  );
}

/**
 * De week en de weergave die alle open roosterschermen delen.
 *
 * Elk scherm hield dit in zijn eigen state, dus wie de Activiteiten planner en het Capaciteit
 * overzicht naast elkaar had staan vergeleek zonder het te merken twee verschillende weken.
 *
 * De maand zit hier niet als datum in. Schermen leiden hun maand af van de week met
 * maandVanWeek, zodat week en maand niet uit elkaar kunnen lopen en er maar één ding rond
 * hoeft te gaan.
 *
 * Schermen die geen capaciteit of expertise kennen, zoals de Afwezigheidsplanner, lezen alleen
 * of het nevenscherm de maand is en tonen anders hun week. Zo blijft er één begrip rondgaan
 * in plaats van twee die uit elkaar lopen.
 *
 * De keuze wordt niet bewaard: opnieuw laden opent op de huidige week, en pas daarna volgen
 * open schermen elkaar. Anders begin je een ochtend onbedoeld in een week van vorige maand
 * omdat je daar gisteren naar keek. Binnen hetzelfde tabblad gaat de week wel mee naar het
 * volgende roosterscherm; zie laatsteWeek voor waarom dat iets anders is.
 *
 * Alleen de week gaat mee, niet wat ernaast staat. De week is waar je bent en die wil je
 * houden; het nevenscherm is hoe je kijkt, en elk scherm kent daar zijn eigen keuzes in.
 *
 * Args:
 *     idwaarneemgroep: Berichten van een andere waarneemgroep worden genegeerd. Twee vensters
 *         op verschillende groepen mogen elkaar niet verzetten.
 */
export function usePlannerWeergave(idwaarneemgroep: number): PlannerWeergave & {
  setWeekStart: (weekStart: string) => void;
  setNevenscherm: (nevenscherm: PlannerNevenscherm) => void;
} {
  const [weergave, setWeergave] = useState<PlannerWeergave>(() => ({
    weekStart:
      laatsteWeek?.idwaarneemgroep === idwaarneemgroep ? laatsteWeek.weekStart : huidigeWeek(),
    nevenscherm: 'geen',
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
        nevenscherm: event.data.nevenscherm,
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

  useEffect(() => {
    laatsteWeek = { idwaarneemgroep, weekStart: weergave.weekStart };
  }, [idwaarneemgroep, weergave.weekStart]);

  const setWeekStart = useCallback((weekStart: string) => {
    setWeergave((huidig) => (huidig.weekStart === weekStart ? huidig : { ...huidig, weekStart }));
  }, []);

  const setNevenscherm = useCallback((nevenscherm: PlannerNevenscherm) => {
    setWeergave((huidig) =>
      huidig.nevenscherm === nevenscherm ? huidig : { ...huidig, nevenscherm }
    );
  }, []);

  return { ...weergave, setWeekStart, setNevenscherm };
}
