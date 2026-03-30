'use client';

import { useEffect, useState } from 'react';
import { cachedGetJson } from '@/lib/cached-fetch';
export { clearCacheByPrefix } from '@/lib/cached-fetch';
import type { DienstenResponse, Dienst } from '@/types/diensten';

export type UseDienstenSubscriptionResult = {
  data: DienstenResponse | null;
  error: string | null;
  loading: boolean;
  /** Increment to force a re-fetch (bypasses cache). */
  refreshKey?: number;
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
  const list: Dienst[] = diensten.map((d: Record<string, unknown> & (typeof diensten)[number]) => ({
    id: d.id ?? 0,
    iddeelnemer: d.iddeelnemer ?? 0,
    van: d.van,
    tot: d.tot,
    type: d.type ?? 0,
    idwaarneemgroep: d.idwaarneemgroep ?? undefined,
    status: (d as { status?: string | null }).status ?? undefined,
    iddienstovern: (d as { iddienstovern?: number }).iddienstovern ?? undefined,
    iddeelnovern: (d as { iddeelnovern?: number }).iddeelnovern ?? undefined,
    senderId: (d as { senderId?: number }).senderId ?? undefined,
    diensten_deelnemers: d.diensten_deelnemers
      ? {
          id: d.diensten_deelnemers.id ?? 0,
          voornaam: d.diensten_deelnemers.voornaam ?? '',
          achternaam: d.diensten_deelnemers.achternaam ?? '',
          color: d.diensten_deelnemers.color ?? '',
        }
      : null,
    target_deelnemers: (() => {
      const td = (d as unknown as { target_deelnemers?: typeof d.diensten_deelnemers }).target_deelnemers;
      return td
        ? { id: td.id ?? 0, voornaam: td.voornaam ?? '', achternaam: td.achternaam ?? '', color: td.color ?? '' }
        : null;
    })(),
  }));
  return { data: { diensten: list } };
}

/**
 * Fetches diensten from GET /api/diensten for the given date range and waarneemgroep IDs.
 * Re-runs when vanGte, totLte, idwaarneemgroepen, typeIn or iddeelnemer change.
 * @param typeIn - Optional: only return diensten with these types (e.g. [1] for unassigned slots).
 * @param iddeelnemer - Optional: only return diensten where iddeelnemer = this (e.g. for "my" preferences).
 */
export function useDienstenSubscription(
  vanGte: number,
  totLte: number,
  idwaarneemgroepen: number[],
  typeIn?: number[],
  iddeelnemer?: number | null,
  _refreshKey?: number
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
    if (iddeelnemer !== undefined && (iddeelnemer === null || iddeelnemer <= 0)) {
      setData({ data: { diensten: [] } });
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
    if (iddeelnemer != null && iddeelnemer > 0) {
      params.set('iddeelnemer', String(iddeelnemer));
    }

    const url = `/api/diensten?${params}`;
    cachedGetJson<{ diensten?: unknown[]; error?: string }>(url)
      .then((json) => {
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
  }, [vanGte, totLte, idwaarneemgroepen.join(','), typeIn?.join(',') ?? '', iddeelnemer ?? '', _refreshKey ?? 0]);

  return { data, error, loading };
}
