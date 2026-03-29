'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { WaarneemgroepItem } from '@/components/header/DoktersdienstHeader';
import { cachedGetJson } from '@/lib/cached-fetch';

const STORAGE_GROUP_ID_KEY = 'groupid';

function getStoredGroupId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const id = localStorage.getItem(STORAGE_GROUP_ID_KEY);
  return id && id.trim() !== '' ? id : null;
}

type ApiWaarneemgroep = { id: number | null; naam: string | null; [key: string]: unknown };

function toWaarneemgroepItem(row: ApiWaarneemgroep): WaarneemgroepItem {
  return {
    ID: row.id ?? 0,
    naam: row.naam ?? '',
  };
}

export interface WaarneemgroepContextValue {
  /** List of waarneemgroepen for the current user (from API). */
  waarneemgroepen: WaarneemgroepItem[];
  /** Currently selected waarneemgroep id (string for select value), or null. */
  activeWaarneemgroepId: string | null;
  /** The selected waarneemgroep object, or null if none selected or not in list. */
  activeWaarneemgroep: WaarneemgroepItem | null;
  /** Set the active waarneemgroep; persists to localStorage and notifies listeners. */
  setActiveWaarneemgroepId: (id: string | null) => void;
  loading: boolean;
  error: string | null;
}

export const WaarneemgroepContext = createContext<WaarneemgroepContextValue | null>(null);

export function useWaarneemgroep(): WaarneemgroepContextValue {
  const ctx = useContext(WaarneemgroepContext);
  if (!ctx) {
    throw new Error('useWaarneemgroep must be used within WaarneemgroepProvider');
  }
  return ctx;
}

export interface WaarneemgroepProviderProps {
  children: ReactNode;
}

export function WaarneemgroepProvider({ children }: WaarneemgroepProviderProps) {
  const [waarneemgroepen, setWaarneemgroepen] = useState<WaarneemgroepItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWaarneemgroepId, setActiveWaarneemgroepIdState] = useState<string | null>(
    () => getStoredGroupId()
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    cachedGetJson<{ waarneemgroepen?: ApiWaarneemgroep[]; error?: string }>('/api/waarneemgroepen')
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setWaarneemgroepen([]);
        } else {
          const list = (data.waarneemgroepen ?? []).map(toWaarneemgroepItem);
          setWaarneemgroepen(list);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Request failed');
          setWaarneemgroepen([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-select first waarneemgroep when none is stored (fresh session)
  useEffect(() => {
    if (!activeWaarneemgroepId && waarneemgroepen.length > 0) {
      const firstId = String(waarneemgroepen[0].ID);
      localStorage.setItem(STORAGE_GROUP_ID_KEY, firstId);
      setActiveWaarneemgroepIdState(firstId);
    }
  }, [activeWaarneemgroepId, waarneemgroepen]);

  const setActiveWaarneemgroepId = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem(STORAGE_GROUP_ID_KEY, id);
    }
    setActiveWaarneemgroepIdState(id);
  }, []);

  const activeWaarneemgroep = useMemo(() => {
    if (!activeWaarneemgroepId) return null;
    return waarneemgroepen.find((wg) => String(wg.ID) === activeWaarneemgroepId) ?? null;
  }, [activeWaarneemgroepId, waarneemgroepen]);

  const value: WaarneemgroepContextValue = useMemo(
    () => ({
      waarneemgroepen,
      activeWaarneemgroepId,
      activeWaarneemgroep,
      setActiveWaarneemgroepId,
      loading,
      error,
    }),
    [
      waarneemgroepen,
      activeWaarneemgroepId,
      activeWaarneemgroep,
      setActiveWaarneemgroepId,
      loading,
      error,
    ]
  );

  return (
    <WaarneemgroepContext.Provider value={value}>
      {children}
    </WaarneemgroepContext.Provider>
  );
}
