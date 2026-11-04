'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useWaarneemgroep } from '@/contexts/WaarneemgroepContext';
import { getPraktijkplannerHomeForRole } from '@/lib/route-access';
import { deriveEffectiveRoleTier, GROEP_ADMINISTRATOR, GROEP_DEELNEMER } from '@/lib/roles';

/** Keeps legacy-style `/praktijkplanner` links stable while opening the role-appropriate screen. */
export default function PraktijkplannerIndexPage() {
  const router = useRouter();
  const { activeWaarneemgroep, waarneemgroepen, loading: wgLoading } = useWaarneemgroep();
  const [globalIdgroep, setGlobalIdgroep] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    const abortController = new AbortController();

    fetch('/api/deelnemers/role', {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Kon rol niet ophalen');
        const data = (await response.json()) as { idgroep?: number | null };
        setGlobalIdgroep(data.idgroep ?? null);
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          setGlobalIdgroep(GROEP_DEELNEMER);
        }
      });

    return () => {
      abortController.abort();
    };
  }, []);

  const isGlobalAdmin = globalIdgroep === GROEP_ADMINISTRATOR;
  const roleTier = useMemo(
    () =>
      deriveEffectiveRoleTier({
        globalIdgroep: globalIdgroep ?? null,
        selectedWaarneemgroepIdgroep: activeWaarneemgroep?.idgroep ?? null,
      }),
    [activeWaarneemgroep?.idgroep, globalIdgroep]
  );

  const roleReady =
    globalIdgroep !== undefined &&
    (isGlobalAdmin || (!wgLoading && (Boolean(activeWaarneemgroep) || waarneemgroepen.length === 0)));

  useEffect(() => {
    if (!roleReady) return;
    void router.replace(getPraktijkplannerHomeForRole(roleTier));
  }, [roleReady, roleTier, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6" role="status">
      <p className="text-muted-foreground">Praktijkplanner openen…</p>
    </div>
  );
}
