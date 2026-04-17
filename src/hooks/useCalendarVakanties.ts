'use client';

import { useEffect, useState } from 'react';
import type { VakantiesResponse } from '@/pages/api/vakanties/index';

/**
 * Loads vakanties that may appear in the month grid (weeks can include days from
 * adjacent calendar years). Merges by id across three year queries.
 */
export function useCalendarVakanties(viewYear: number): VakantiesResponse['vakanties'] {
  const [vakanties, setVakanties] = useState<VakantiesResponse['vakanties']>([]);

  useEffect(() => {
    let cancelled = false;
    const years = [viewYear - 1, viewYear, viewYear + 1];
    void Promise.all(
      years.map((y) =>
        fetch(`/api/vakanties?year=${y}`, { credentials: 'include' }).then(async (r) => {
          if (!r.ok) return null;
          return (await r.json()) as VakantiesResponse & { error?: string };
        })
      )
    ).then((responses) => {
      if (cancelled) return;
      const byId = new Map<number, VakantiesResponse['vakanties'][number]>();
      for (const d of responses) {
        if (!d || ('error' in d && d.error) || !Array.isArray(d.vakanties)) continue;
        for (const v of d.vakanties) {
          byId.set(v.id, v);
        }
      }
      setVakanties([...byId.values()]);
    });
    return () => {
      cancelled = true;
    };
  }, [viewYear]);

  return vakanties;
}
