'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

/** Zaterdag en zondag als ISO-weekdag. */
const WEEKENDDAGEN = [6, 7];

/**
 * Of het weekend uit de roosters gelaten is.
 *
 * Een variabele in deze module en geen state in een scherm, omdat op de Activiteiten planner de
 * week en een nevenscherm naast elkaar staan, elk met hun eigen berekening van welke weekdagen
 * ze overslaan. Die moeten samen omklappen en niet los.
 *
 * De stand wordt ook bewaard, per deelnemer en waarneemgroep, in dezelfde tabel als de knop
 * voor avond en nacht ernaast. Deze variabele is dus geen bewaarplek maar een kopie: hij vangt
 * op wat er van de server komt en houdt de open schermen gelijk tot de volgende keer laden.
 */
let weekendVerborgen = false;

/**
 * De waarneemgroep waarvoor de voorkeur is opgehaald, of op dit moment wordt opgehaald.
 *
 * Zonder dit haalt elk scherm de voorkeur opnieuw op, en houdt een scherm na het wisselen van
 * waarneemgroep de stand van de vorige groep vast.
 */
let geladenVoorGroep: number | null = null;

const luisteraars = new Set<() => void>();

function meld(): void {
  for (const luisteraar of luisteraars) luisteraar();
}

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
 * De variabele hierboven wordt daar nooit gevuld, want de voorkeur wordt in de browser
 * opgehaald. Zou de server de laatste stand van een willekeurige bezoeker teruggeven, dan zou
 * hij die van de volgende meesturen.
 */
function leesOpServer(): boolean {
  return false;
}

function zet(volgende: boolean): void {
  if (weekendVerborgen === volgende) return;
  weekendVerborgen = volgende;
  meld();
}

/**
 * Haalt de bewaarde stand op, eenmaal per waarneemgroep.
 *
 * Geen AbortController en geen opruimen bij het verdwijnen van het scherm. Dit schrijft in een
 * variabele van deze module en niet in de state van een component, dus er valt na het
 * verdwijnen niets meer stuk te maken. Een eerdere versie brak het verzoek wel af bij het
 * opruimen, en die laadde in ontwikkeling nooit: React hangt effecten daar twee keer op, het
 * eerste verzoek werd door het opruimen afgebroken en het tweede zag de groep al als geladen
 * staan. Het scherm toonde dan altijd het weekend, hoe je het ook had achtergelaten.
 */
async function laadVoorkeur(idwaarneemgroep: number): Promise<void> {
  if (geladenVoorGroep === idwaarneemgroep) return;
  geladenVoorGroep = idwaarneemgroep;
  try {
    const response = await fetch(
      `/api/praktijkplanner/voorkeuren?idwaarneemgroep=${idwaarneemgroep}`,
      { credentials: 'include' }
    );
    if (!response.ok) throw new Error('geen voorkeur');
    const payload = (await response.json()) as { toonWeekend?: boolean };
    if (typeof payload.toonWeekend === 'boolean') zet(!payload.toonWeekend);
  } catch {
    // Opnieuw mogen proberen bij het volgende scherm, anders blijft een hik van een seconde de
    // rest van de sessie hangen.
    if (geladenVoorGroep === idwaarneemgroep) geladenVoorGroep = null;
  }
}

/**
 * De stand van de knop, voor een rooster dat hem alleen hoeft te volgen.
 *
 * Voor het scherm dat de knop ophangt is useWeekendVoorkeur er, die ook laadt en bewaart.
 */
export function useWeekendVerbergen(): { weekendVerborgen: boolean } {
  return { weekendVerborgen: useSyncExternalStore(abonneer, lees, leesOpServer) };
}

/**
 * De knop zelf: de stand, en het omzetten dat meteen bewaard wordt.
 *
 * Het ophalen gebeurt eenmaal per waarneemgroep en niet per scherm, want alle schermen delen
 * dezelfde stand. Mislukt het ophalen of het bewaren, dan blijft het scherm gewoon werken met
 * het weekend zichtbaar; dit is beeld, geen inhoud, en een foutmelding over een kolom in een
 * voorkeurentabel helpt niemand midden in het plannen.
 */
export function useWeekendVoorkeur(idwaarneemgroep: number): {
  weekendVerborgen: boolean;
  setWeekendVerborgen: (verborgen: boolean) => void;
} {
  const verborgen = useSyncExternalStore(abonneer, lees, leesOpServer);

  useEffect(() => {
    void laadVoorkeur(idwaarneemgroep);
  }, [idwaarneemgroep]);

  const setWeekendVerborgen = useCallback(
    (volgende: boolean) => {
      zet(volgende);
      void fetch('/api/praktijkplanner/voorkeuren', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // Alleen dit veld. De knop voor avond en nacht heeft zijn eigen stand en die hoort
        // hier niet meegeschreven te worden.
        body: JSON.stringify({ idwaarneemgroep, toonWeekend: !volgende }),
      }).catch(() => undefined);
    },
    [idwaarneemgroep]
  );

  return { weekendVerborgen: verborgen, setWeekendVerborgen };
}

/**
 * De weekdagen die een rooster overslaat, met het weekend erbij als de knop aan staat.
 *
 * Los van de knop houdt een groep al weekdagen zonder rooster; zie weekdagenZonderRooster. Die
 * twee komen hier bij elkaar, zodat een rooster naar een verzameling kijkt en niet naar het
 * verschil tussen "deze groep werkt nooit op zondag" en "ik wil het weekend nu even niet zien".
 */
export function metVerborgenWeekend(
  weekdagenZonderRooster: ReadonlySet<number>,
  weekendVerborgen: boolean
): ReadonlySet<number> {
  if (!weekendVerborgen) return weekdagenZonderRooster;
  return new Set([...weekdagenZonderRooster, ...WEEKENDDAGEN]);
}
