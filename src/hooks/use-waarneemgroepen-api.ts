'use client';

import { useEffect, useState } from 'react';

export type WaarneemgroepApiRow = {
  id: number | null;
  naam?: string | null;
  [key: string]: unknown;
};

export type UseWaarneemgroepenApiResult = {
  data: WaarneemgroepApiRow[] | null;
  error: string | null;
  loading: boolean;
};

/**
 * Fetches waarneemgroepen from GET /api/waarneemgroepen (session-based, same logic as legacy).
 * Use this when you need the list of waarneemgroepen the user has access to for diensten/subscriptions.
 */
export function useWaarneemgroepenApi(): UseWaarneemgroepenApiResult {
  const [data, setData] = useState<WaarneemgroepApiRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/waarneemgroepen', { credentials: 'include' });
        if (cancelled) return;
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error ?? `HTTP ${res.status}`);
          setData(null);
        } else if (Array.isArray(json.waarneemgroepen)) {
          setData(json.waarneemgroepen);
          setError(null);
        } else {
          setData([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load waarneemgroepen');
          setData(null);
        }
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error, loading };
}
