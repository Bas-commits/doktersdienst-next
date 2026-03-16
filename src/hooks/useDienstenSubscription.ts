'use client';

import { useEffect, useState } from 'react';
import type { DienstenResponse, Dienst } from '@/types/diensten';

export type UseDienstenSubscriptionResult = {
  data: DienstenResponse | null;
  error: string | null;
  loading: boolean;
};

/** API returns diensten with van/tot as number and diensten_deelnemers; normalize to our type. */
function toDienstenResponse(diensten: Array<{
  id: number | null;
  iddeelnemer: number | null;
  van: number;
  tot: number;
  type: number | null;
  idwaarneemgroep: number | null;
  diensten_deelnemers: {
    id: number | null;
    voornaam: string | null;
    achternaam: string | null;
    color: string | null;
  } | null;
}>): DienstenResponse {
  const list: Dienst[] = diensten.map((d) => ({
    id: d.id ?? 0,
    iddeelnemer: d.iddeelnemer ?? 0,
    van: d.van,
    tot: d.tot,
    type: d.type ?? 0,
    idwaarneemgroep: d.idwaarneemgroep ?? undefined,
    diensten_deelnemers: d.diensten_deelnemers
      ? {
          id: d.diensten_deelnemers.id ?? 0,
          voornaam: d.diensten_deelnemers.voornaam ?? '',
          achternaam: d.diensten_deelnemers.achternaam ?? '',
          color: d.diensten_deelnemers.color ?? '',
        }
      : null,
  }));
  return { data: { diensten: list } };
}

/**
 * Fetches diensten from GET /api/diensten for the given date range and waarneemgroep IDs.
 * Re-runs when vanGte, totLte, idwaarneemgroepen or typeIn change.
 * @param typeIn - Optional: only return diensten with these types (e.g. [1] for unassigned slots).
 */
export function useDienstenSubscription(
  vanGte: number,
  totLte: number,
  idwaarneemgroepen: number[],
  typeIn?: number[]
): UseDienstenSubscriptionResult {
  const [data, setData] = useState<DienstenResponse | null>(null);
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
    if (typeIn != null && typeIn.length > 0) {
      params.set('typeIn', typeIn.join(','));
    }

    fetch(`/api/diensten?${params}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((json: { diensten?: unknown[]; error?: string }) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
          setData(null);
        } else if (Array.isArray(json.diensten)) {
          setData(toDienstenResponse(json.diensten as Parameters<typeof toDienstenResponse>[0]));
          setError(null);
        } else {
          setData({ data: { diensten: [] } });
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load diensten');
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [vanGte, totLte, idwaarneemgroepen.join(','), typeIn?.join(',') ?? '']);

  return { data, error, loading };
}
