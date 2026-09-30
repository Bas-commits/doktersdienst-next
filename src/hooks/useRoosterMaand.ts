'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type RoosterMaand = {
  /** 0-11, zoals Date.getMonth. */
  month: number;
  year: number;
};

/**
 * Eén kanaal voor Rooster maken en de Urentelling in een eigen tabblad. Zelfde aanpak als
 * usePlannerWeergave bij de Praktijkplanner: BroadcastChannel bereikt elk tabblad en venster
 * van hetzelfde adres.
 */
const KANAAL_NAAM = 'doktersdienst-rooster-maand';

type MaandBericht = RoosterMaand & { idwaarneemgroep: number };

function isMaandBericht(value: unknown): value is MaandBericht {
  if (typeof value !== 'object' || value === null) return false;
  const bericht = value as Record<string, unknown>;
  return (
    typeof bericht.idwaarneemgroep === 'number' &&
    Number.isInteger(bericht.month) &&
    (bericht.month as number) >= 0 &&
    (bericht.month as number) <= 11 &&
    Number.isInteger(bericht.year)
  );
}

/**
 * De maand van Rooster maken, gedeeld met de Urentelling in een eigen tabblad.
 *
 * Op een scherm dat te smal is voor rooster en Urentelling naast elkaar opent de Urentelling in
 * een nieuw tabblad. Die moet dan de maand van het rooster volgen: bladert de secretaris naar de
 * volgende maand, dan telt de Urentelling ook die maand. Kaart: https://trello.com/c/FHVfCvMC
 *
 * Het openen van een tabblad zendt niets uit, anders zette een nieuw tabblad het rooster terug.
 *
 * Args:
 *     idwaarneemgroep: Berichten van een andere groep worden genegeerd, zodat twee tabbladen op
 *         verschillende groepen elkaar niet verzetten. Null (groep nog niet bekend) deelt niets.
 *     begin: De maand waarmee dit tabblad opent.
 */
export function useRoosterMaand(
  idwaarneemgroep: number | null,
  begin: RoosterMaand
): RoosterMaand & { setMaand: (month: number, year: number) => void } {
  const [maand, setMaandState] = useState<RoosterMaand>(begin);
  const kanaal = useRef<BroadcastChannel | null>(null);
  // Wat er als laatste over het kanaal ging, in of uit. Zonder dit stuurt een tabblad het
  // bericht dat het net ontving meteen weer terug.
  const laatsteBericht = useRef<string | null>(null);

  useEffect(() => {
    if (idwaarneemgroep === null || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(KANAAL_NAAM);
    kanaal.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isMaandBericht(event.data) || event.data.idwaarneemgroep !== idwaarneemgroep) return;
      const volgende: RoosterMaand = { month: event.data.month, year: event.data.year };
      laatsteBericht.current = JSON.stringify(volgende);
      setMaandState(volgende);
    };
    return () => {
      channel.close();
      kanaal.current = null;
    };
  }, [idwaarneemgroep]);

  useEffect(() => {
    const inhoud = JSON.stringify(maand);
    if (laatsteBericht.current === null) {
      laatsteBericht.current = inhoud;
      return;
    }
    if (laatsteBericht.current === inhoud || idwaarneemgroep === null) return;
    laatsteBericht.current = inhoud;
    kanaal.current?.postMessage({ idwaarneemgroep, ...maand } satisfies MaandBericht);
  }, [idwaarneemgroep, maand]);

  const setMaand = useCallback((month: number, year: number) => {
    setMaandState((huidig) =>
      huidig.month === month && huidig.year === year ? huidig : { month, year }
    );
  }, []);

  return { ...maand, setMaand };
}
