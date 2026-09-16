'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  UrentellingColumn,
  UrentellingCommitmentCell,
  UrentellingDetailRow,
  UrentellingRow,
} from '@/lib/urentelling';

type UrentellingApiResponse = {
  van?: number;
  tot?: number;
  columns?: UrentellingColumn[];
  rows?: UrentellingRow[];
  details?: UrentellingDetailRow[];
  commitment?: {
    totalFte: number;
    perRow: UrentellingCommitmentCell[][];
  };
  error?: string;
};

export type UrentellingState = {
  columns: UrentellingColumn[];
  rows: UrentellingRow[];
  details: UrentellingDetailRow[];
  commitmentPerRow: UrentellingCommitmentCell[][];
  responseVan: number | null;
  responseTot: number | null;
  loading: boolean;
  error: string | null;
};

const LEEG: UrentellingState = {
  columns: [],
  rows: [],
  details: [],
  commitmentPerRow: [],
  responseVan: null,
  responseTot: null,
  loading: false,
  error: null,
};

/**
 * Haalt de urentelling op voor een waarneemgroep en periode, in unix-seconden.
 *
 * Losgetrokken uit urentelling.tsx zodat het Urentelling-paneel naast het rooster (zie
 * UrentellingPanel.tsx) dezelfde ophaalactie gebruikt als de eigen pagina, in plaats van een
 * tweede kopie die bij de eerste wijziging uit elkaar loopt.
 *
 * Args:
 *     idwaarneemgroep: null laat de ophaalactie achterwege - er is dan nog geen groep gekozen.
 *     vanGte / totLte: unix-seconden. null laat de ophaalactie ook achterwege.
 */
export function useUrentelling(
  idwaarneemgroep: number | null,
  vanGte: number | null,
  totLte: number | null
): UrentellingState {
  const [state, setState] = useState<UrentellingState>(LEEG);

  const load = useCallback(async (groep: number, van: number, tot: number, signal: AbortSignal) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const searchParams = new URLSearchParams({
        idwaarneemgroep: String(groep),
        vanGte: String(van),
        totLte: String(tot),
      });
      const response = await fetch(`/api/urentelling?${searchParams.toString()}`, {
        credentials: 'include',
        signal,
      });
      const data = (await response.json()) as UrentellingApiResponse;
      if (!response.ok || data.error) {
        throw new Error(data.error ?? 'Kon urentelling niet laden');
      }
      if (signal.aborted) return;
      setState({
        columns: data.columns ?? [],
        rows: data.rows ?? [],
        details: data.details ?? [],
        commitmentPerRow: data.commitment?.perRow ?? [],
        responseVan: data.van ?? van,
        responseTot: data.tot ?? tot,
        loading: false,
        error: null,
      });
    } catch (err) {
      if (signal.aborted) return;
      setState({
        ...LEEG,
        error: err instanceof Error ? err.message : 'Kon urentelling niet laden',
      });
    }
  }, []);

  useEffect(() => {
    if (idwaarneemgroep == null || vanGte == null || totLte == null) {
      setState(LEEG);
      return;
    }
    const abortController = new AbortController();
    void load(idwaarneemgroep, vanGte, totLte, abortController.signal);
    return () => abortController.abort();
  }, [idwaarneemgroep, vanGte, totLte, load]);

  return state;
}
