'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { fetchHasura } from '@/lib/hasura-client';
import {
  WAARNEMGROEPEN_QUERY,
  type Waarneemgroep,
  type WaarneemgroepenResponse,
} from '@/lib/graphql/waarneemgroepen';

export type UseWaarneemgroepenResult = {
  data: Waarneemgroep[] | null;
  error: string | null;
  loading: boolean;
};

/**
 * Fetches waarneemgroepen from Hasura using the current user's JWT.
 * Use this in any component that needs the list; the list component stays presentational.
 */
export function useWaarneemgroepen(): UseWaarneemgroepenResult {
  const [data, setData] = useState<Waarneemgroep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const { data: tokenData } = await authClient.token();
      const token = tokenData?.token ?? null;

      const result = await fetchHasura<WaarneemgroepenResponse>({
        query: WAARNEMGROEPEN_QUERY,
        token,
      });

      if (cancelled) return;

      if (result.errors?.length) {
        setError(result.errors.map((e) => e.message).join(', '));
        setData(null);
      } else if (result.data?.waarneemgroepen) {
        setData(result.data.waarneemgroepen);
      } else {
        setData([]);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error, loading };
}
