'use client';

import { useCallback, useEffect, useState } from 'react';
import { openNevenschermTabblad } from '@/lib/nevenscherm-tabblad';

/** Hoe vaak het hoofdtabblad kijkt of het losse tabblad nog open is. */
const CONTROLE_MS = 1000;

/**
 * Of het nevenscherm in een eigen tabblad openstaat, gezien vanuit het hoofdtabblad.
 *
 * Zolang dat zo is laat het hoofdtabblad het nevenscherm weg en toont het de week of het rooster.
 * Sluit de planner het losse tabblad, dan moet dat weer terugkomen, anders is het nevenscherm
 * nergens meer te zien terwijl de knop zegt dat het openstaat. Een tabblad meldt zijn eigen
 * sluiten niet betrouwbaar (pagehide komt niet altijd door), dus het hoofdtabblad kijkt zelf
 * naar `closed`. Kaart: https://trello.com/c/FHVfCvMC
 *
 * Args:
 *     naam: Vaste naam van het tabblad, zodat een tweede klik hetzelfde tabblad hergebruikt.
 *
 * Returns:
 *     geopend: het losse tabblad staat open.
 *     openen: opent het tabblad op dit adres, of zet het bestaande op dit adres en haalt het
 *         naar voren.
 */
export function useNevenschermTabblad(naam: string): {
  geopend: boolean;
  openen: (url: string) => void;
} {
  const [tabblad, setTabblad] = useState<Window | null>(null);

  useEffect(() => {
    if (tabblad === null) return;
    const controle = window.setInterval(() => {
      if (tabblad.closed) setTabblad(null);
    }, CONTROLE_MS);
    return () => window.clearInterval(controle);
  }, [tabblad]);

  const openen = useCallback(
    (url: string) => {
      setTabblad(openNevenschermTabblad(url, naam));
    },
    [naam]
  );

  return { geopend: tabblad !== null, openen };
}
