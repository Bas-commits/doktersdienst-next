'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { authClient } from '@/lib/auth-client';
import { DoktersdienstHeader } from '@/components/header/DoktersdienstHeader';
import { Sidebar } from '@/components/layout/Sidebar';
import { DeelnemerProfileProvider } from '@/contexts/DeelnemerProfileContext';
import { useWaarneemgroep, WaarneemgroepProvider } from '@/contexts/WaarneemgroepContext';
import {
  DEFAULT_ASSET_URLS,
  DEFAULT_ROUTES,
  headerUserFromSession,
  EMPTY_WAARNEMGROEPEN,
} from '@/lib/header-defaults';
import { getAppSection, isRouteAllowedForRole } from '@/lib/route-access';
import { isPraktijkplannerEnabled } from '@/lib/praktijkplanner/feature-flag';
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
  displayName?: string;
  initialen?: string | null;
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
  const section = getAppSection(router.pathname);
  const praktijkplannerEnabled = isPraktijkplannerEnabled();
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
    () =>
      isRouteAllowedForRole(router.pathname, resolvedRoleTier) &&
      (section !== 'praktijkplanner' || praktijkplannerEnabled),
    [praktijkplannerEnabled, router.pathname, resolvedRoleTier, section]
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
        section={section}
        showSectionSwitch={praktijkplannerEnabled}
      />
      <div className="flex flex-1">
        <Sidebar roleTier={resolvedRoleTier} section={section} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

export function AuthenticatedLayout({ children, headerProps }: AuthenticatedLayoutProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [globalIdgroep, setGlobalIdgroep] = useState<number | null | undefined>(undefined);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [initialen, setInitialen] = useState<string | null>(null);
  const [accountGateReady, setAccountGateReady] = useState(false);

  const headerUser = useMemo(
    () => headerUserFromSession(session?.user ?? null, { displayName, initialen }),
    [session?.user, displayName, initialen]
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
        if (data.displayName?.trim()) {
          setDisplayName(data.displayName.trim());
        }
        if (data.initialen?.trim()) {
          setInitialen(data.initialen.trim());
        }
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

  useEffect(() => {
    if (isPending || !session?.user) return;

    const abortController = new AbortController();

    fetch('/api/account/status', {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          setAccountGateReady(true);
          return;
        }
        const data = (await response.json()) as {
          needsEmailOnboarding?: boolean;
        };
        if (data.needsEmailOnboarding === true) {
          router.replace('/account/email-instellen');
          return;
        }
        setAccountGateReady(true);
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          setAccountGateReady(true);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [session?.user, isPending, router]);

  const isGlobalRoleLoading = !isPending && !!session?.user && globalIdgroep === undefined;
  const isAccountGateLoading = !isPending && !!session?.user && !accountGateReady;

  if (isPending || isGlobalRoleLoading || isAccountGateLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4" role="status" aria-label="Laden">
        <p className="text-muted-foreground">Laden…</p>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const resolvedDisplayName =
    displayName?.trim() ||
    session.user.name?.trim() ||
    session.user.email?.trim() ||
    'Gebruiker';

  return (
    <DeelnemerProfileProvider displayName={resolvedDisplayName}>
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
    </DeelnemerProfileProvider>
  );
}
