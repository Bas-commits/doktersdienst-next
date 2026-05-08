'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { authClient } from '@/lib/auth-client';
import { DoktersdienstHeader } from '@/components/header/DoktersdienstHeader';
import { Sidebar } from '@/components/layout/Sidebar';
import { useWaarneemgroep, WaarneemgroepProvider } from '@/contexts/WaarneemgroepContext';
import {
  DEFAULT_ASSET_URLS,
  DEFAULT_ROUTES,
  headerUserFromSession,
  EMPTY_WAARNEMGROEPEN,
} from '@/lib/header-defaults';
import { isRouteAllowedForRole } from '@/lib/route-access';
import {
  deriveEffectiveRoleTier,
  GROEP_ADMINISTRATOR,
  GROEP_DEELNEMER,
  type RoleTier,
} from '@/lib/roles';

export interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  /** Override header data when provided by page (e.g. from getServerSideProps) */
  headerProps?: Partial<{
    waarneemgroepen: { ID: number; naam: string }[];
    routeName: string | null;
  }>;
}

type RoleApiResponse = {
  idgroep?: number | null;
};

type AuthenticatedLayoutShellProps = {
  children: React.ReactNode;
  headerUser: ReturnType<typeof headerUserFromSession>;
  fallbackWaarneemgroepen: { ID: number; naam: string }[];
  routeName: string | null;
  globalIdgroep: number | null;
};

function AuthenticatedLayoutShell({
  children,
  headerUser,
  fallbackWaarneemgroepen,
  routeName,
  globalIdgroep,
}: AuthenticatedLayoutShellProps) {
  const router = useRouter();
  const { activeWaarneemgroep, waarneemgroepen, loading: wgLoading } = useWaarneemgroep();
  const isGlobalAdmin = globalIdgroep === GROEP_ADMINISTRATOR;
  const resolvedRoleTier: RoleTier = useMemo(
    () =>
      deriveEffectiveRoleTier({
        globalIdgroep,
        selectedWaarneemgroepIdgroep: activeWaarneemgroep?.idgroep ?? null,
      }),
    [activeWaarneemgroep?.idgroep, globalIdgroep]
  );

  const isRoleLoading =
    !isGlobalAdmin &&
    (wgLoading || (!activeWaarneemgroep && waarneemgroepen.length > 0));

  const isAllowedRoute = useMemo(
    () => isRouteAllowedForRole(router.pathname, resolvedRoleTier),
    [router.pathname, resolvedRoleTier]
  );

  useEffect(() => {
    if (isRoleLoading) return;
    if (isAllowedRoute) return;
    router.replace('/rooster-inzien');
  }, [isAllowedRoute, isRoleLoading, router]);

  if (isRoleLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4" role="status" aria-label="Laden">
        <p className="text-muted-foreground">Laden…</p>
      </div>
    );
  }

  if (!isAllowedRoute) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4" role="status" aria-label="Doorsturen">
        <p className="text-muted-foreground">Doorsturen…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DoktersdienstHeader
        waarneemgroepen={fallbackWaarneemgroepen}
        headerUser={headerUser}
        routes={DEFAULT_ROUTES}
        routeName={routeName}
        assetUrls={DEFAULT_ASSET_URLS}
      />
      <div className="flex flex-1">
        <Sidebar roleTier={resolvedRoleTier} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

export function AuthenticatedLayout({ children, headerProps }: AuthenticatedLayoutProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [globalIdgroep, setGlobalIdgroep] = useState<number | null | undefined>(undefined);

  const headerUser = useMemo(
    () => headerUserFromSession(session?.user ?? null),
    [session?.user]
  );

  const fallbackWaarneemgroepen = headerProps?.waarneemgroepen ?? EMPTY_WAARNEMGROEPEN;

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.replace('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (isPending || !session?.user || globalIdgroep !== undefined) return;

    const abortController = new AbortController();

    fetch('/api/deelnemers/role', {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Kon rol niet ophalen');
        }
        const data = (await response.json()) as RoleApiResponse;
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
  }, [session?.user, isPending, globalIdgroep]);

  const isGlobalRoleLoading = !isPending && !!session?.user && globalIdgroep === undefined;

  if (isPending || isGlobalRoleLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4" role="status" aria-label="Laden">
        <p className="text-muted-foreground">Laden…</p>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <WaarneemgroepProvider>
      <AuthenticatedLayoutShell
        headerUser={headerUser}
        fallbackWaarneemgroepen={fallbackWaarneemgroepen}
        routeName={headerProps?.routeName ?? null}
        globalIdgroep={globalIdgroep ?? null}
      >
        {children}
      </AuthenticatedLayoutShell>
    </WaarneemgroepProvider>
  );
}
