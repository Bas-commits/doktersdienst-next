'use client';

import { useEffect, useState } from 'react';
import { cachedGetJson } from '@/lib/cached-fetch';

export type Voorkeur = {
  id: number | null;
  iddeelnemer: number | null;
  van: number;
  tot: number;
  type: number | null;
  idwaarneemgroep: number | null;
  idtaaktype: number | null;
  taaktypeKleur: string | null;
  deelnemer: {
    id: number | null;
    voornaam: string | null;
    achternaam: string | null;
    color: string | null;
  } | null;
};

export type UseVoorkeurenSubscriptionResult = {
  data: Voorkeur[] | null;
  error: string | null;
  loading: boolean;
};

/**
 * Fetches voorkeuren from GET /api/diensten/voorkeuren for the given date range
 * and waarneemgroep IDs. Only returns voorkeuren of aangemelde deelnemers.
 */
export function useVoorkeurenSubscription(
  vanGte: number,
  totLte: number,
  idwaarneemgroepen: number[]
): UseVoorkeurenSubscriptionResult {
  const [data, setData] = useState<Voorkeur[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (idwaarneemgroepen.length === 0) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let cancelled = false;
    const params = new URLSearchParams({
      vanGte: String(vanGte),
      totLte: String(totLte),
      idwaarneemgroepIn: idwaarneemgroepen.join(','),
    });

    const url = `/api/diensten/voorkeuren?${params}`;
    cachedGetJson<{ voorkeuren?: unknown[]; error?: string }>(url)
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
          setData(null);
        } else if (Array.isArray(json.voorkeuren)) {
          setData(json.voorkeuren as Voorkeur[]);
          setError(null);
        } else {
          setData([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load voorkeuren');
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [vanGte, totLte, idwaarneemgroepen.join(',')]);

  return { data, error, loading };
}
