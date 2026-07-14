import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import type {
  PraktijkplannerMasterData,
  PraktijkplannerParticipant,
} from '@/types/praktijkplanner';

export type PraktijkplannerContextData = {
  idwaarneemgroep: number;
  userId: number;
  isManager: boolean;
  isAdmin: boolean;
  participants: PraktijkplannerParticipant[];
  masterData: PraktijkplannerMasterData;
};

export function usePraktijkplannerContext() {
  const { activeWaarneemgroepId, activeWaarneemgroep, loading: groupLoading } = useWaarneemgroep();
  const groupId = useMemo(() => {
    const id = Number(activeWaarneemgroepId);
    return Number.isInteger(id) && id > 0 ? id : null;
  }, [activeWaarneemgroepId]);
  const [data, setData] = useState<PraktijkplannerContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    if (groupLoading || !groupId) return;

    const abortController = new AbortController();
    queueMicrotask(() => {
      if (abortController.signal.aborted) return;
      setLoading(true);
      setError(null);
      fetch(`/api/praktijkplanner/context?idwaarneemgroep=${groupId}`, {
        credentials: 'include',
        signal: abortController.signal,
      })
        .then(async (response) => {
          const payload = (await response.json()) as PraktijkplannerContextData | { error?: string };
          if (!response.ok || !('masterData' in payload)) {
            throw new Error('error' in payload ? payload.error || 'De plannercontext kon niet worden geladen.' : 'De plannercontext kon niet worden geladen.');
          }
          return payload;
        })
        .then((payload) => {
          if (!abortController.signal.aborted) setData(payload);
        })
        .catch((reason: unknown) => {
          if (!abortController.signal.aborted) {
            setData(null);
            setError(reason instanceof Error ? reason.message : 'De plannercontext kon niet worden geladen.');
          }
        })
        .finally(() => {
          if (!abortController.signal.aborted) setLoading(false);
        });
    });

    return () => abortController.abort();
  }, [groupId, groupLoading, reloadKey]);

  return {
    groupId,
    groupName: activeWaarneemgroep?.naam ?? null,
    data: groupId ? data : null,
    loading: groupLoading || (groupId ? loading : false),
    error: groupId ? error : 'Kies eerst een waarneemgroep in de header.',
    reload,
  };
}
