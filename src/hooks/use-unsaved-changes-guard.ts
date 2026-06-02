'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

export function useUnsavedChangesGuard(isDirty: boolean) {
  const router = useRouter();
  const [pendingNavUrl, setPendingNavUrl] = useState<string | null>(null);
  const allowNavRef = useRef(false);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      if (isDirtyRef.current && !allowNavRef.current) {
        setPendingNavUrl(url);
        router.events.emit('routeChangeError');
        throw 'routeChange aborted.';
      }
      allowNavRef.current = false;
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    return () => router.events.off('routeChangeStart', handleRouteChangeStart);
  }, [router]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const cancelNavigation = useCallback(() => {
    setPendingNavUrl(null);
  }, []);

  const proceedWithoutSaving = useCallback(() => {
    if (!pendingNavUrl) return;
    const url = pendingNavUrl;
    setPendingNavUrl(null);
    allowNavRef.current = true;
    void router.push(url);
  }, [pendingNavUrl, router]);

  const proceedAfterSave = useCallback(
    async (save: () => Promise<boolean>) => {
      const ok = await save();
      if (!ok || !pendingNavUrl) return false;
      const url = pendingNavUrl;
      setPendingNavUrl(null);
      allowNavRef.current = true;
      void router.push(url);
      return true;
    },
    [pendingNavUrl, router]
  );

  return {
    pendingNavUrl,
    cancelNavigation,
    proceedWithoutSaving,
    proceedAfterSave,
  };
}
