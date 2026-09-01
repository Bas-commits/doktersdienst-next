'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Zaterdag en zondag als ISO-weekdag. */
const WEEKENDDAGEN = [6, 7];

/**
 * Of het weekend uit de roosters gelaten is, binnen dit tabblad.
 *
 * Een variabele in deze module en geen state in een scherm, om twee redenen. Ten eerste staan
 * op de Activiteiten planner de week en een nevenscherm naast elkaar, elk met hun eigen
 * berekening van welke weekdagen ze overslaan; die moeten samen omklappen en niet los. Ten
 * tweede haalt doorklikken naar het volgende roosterscherm het vorige weg, dus zonder dit zou
 * de keuze bij elk scherm opnieuw gemaakt moeten worden. Zie laatsteWeek in usePlannerWeergave
 * voor dezelfde afweging bij de week.
 *
 * Bewust niet opgeslagen op de server, anders dan de knop voor avond en nacht die ernaast
 * staat. Dat zou een kolom in praktijkplannerweergavevoorkeuren vragen. Opnieuw laden toont het
 * weekend dus weer.
 */
let weekendVerborgen = false;

const luisteraars = new Set<() => void>();

function abonneer(luisteraar: () => void): () => void {
  luisteraars.add(luisteraar);
  return () => {
    luisteraars.delete(luisteraar);
  };
}

function lees(): boolean {
  return weekendVerborgen;
}

/**
 * Op de server staat het weekend altijd aan.
 *
 * De variabele hierboven wordt daar nooit gevuld, want de knop bestaat alleen in de browser.
 * Zou de server de laatste stand van een willekeurige bezoeker teruggeven, dan zou hij die van
 * de volgende meesturen.
 */
function leesOpServer(): boolean {
  return false;
}

/**
 * De knop weekend verbergen, gedeeld door alle roosters die op dat moment openstaan.
 */
export function useWeekendVerbergen(): {
  weekendVerborgen: boolean;
  setWeekendVerborgen: (verborgen: boolean) => void;
} {
  const verborgen = useSyncExternalStore(abonneer, lees, leesOpServer);
  const setWeekendVerborgen = useCallback((volgende: boolean) => {
    if (weekendVerborgen === volgende) return;
    weekendVerborgen = volgende;
    for (const luisteraar of luisteraars) luisteraar();
  }, []);
  return { weekendVerborgen: verborgen, setWeekendVerborgen };
}

/**
 * De weekdagen die een rooster overslaat, met het weekend erbij als de knop aan staat.
 *
 * Los van de knop houdt een groep al weekdagen zonder rooster; zie weekdagenZonderRooster. Die
 * twee komen hier bij elkaar, zodat een rooster maar naar een verzameling hoeft te kijken en
 * niet naar het verschil tussen "deze groep werkt nooit op zondag" en "ik wil het weekend nu
 * even niet zien".
 */
export function metVerborgenWeekend(
  weekdagenZonderRooster: ReadonlySet<number>,
  weekendVerborgen: boolean
): ReadonlySet<number> {
  if (!weekendVerborgen) return weekdagenZonderRooster;
  return new Set([...weekdagenZonderRooster, ...WEEKENDDAGEN]);
}
