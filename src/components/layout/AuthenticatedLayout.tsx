'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { authClient } from '@/lib/auth-client';
import { DoktersdienstHeader } from '@/components/header/DoktersdienstHeader';
import {
  DEFAULT_ASSET_URLS,
  DEFAULT_ROUTES,
  headerUserFromSession,
  EMPTY_WAARNEMGROEPEN,
} from '@/lib/header-defaults';

function getSwitchRequestUrls(): { switchRequestUrl: string; invalidateSwitchRequestUrl: string } {
  if (typeof window === 'undefined') return { switchRequestUrl: '', invalidateSwitchRequestUrl: '' };
  const base = window.location.origin;
  return {
    switchRequestUrl: `${base}/api/switch-request`,
    invalidateSwitchRequestUrl: `${base}/api/invalidate-switch-request`,
  };
}

export interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  /** Override header data when provided by page (e.g. from getServerSideProps) */
  headerProps?: Partial<{
    waarneemgroepen: { ID: number; naam: string }[];
    routeName: string | null;
  }>;
}

export function AuthenticatedLayout({ children, headerProps }: AuthenticatedLayoutProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const { switchRequestUrl, invalidateSwitchRequestUrl } = useMemo(getSwitchRequestUrls, []);

  const headerUser = useMemo(
    () => headerUserFromSession(session?.user ?? null),
    [session?.user]
  );

  const waarneemgroepen = headerProps?.waarneemgroepen ?? EMPTY_WAARNEMGROEPEN;

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.replace('/login');
    }
  }, [session, isPending, router]);

  if (isPending) {
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
    <div className="flex min-h-screen flex-col">
      <DoktersdienstHeader
        waarneemgroepen={waarneemgroepen}
        headerUser={headerUser}
        switchRequestUrl={switchRequestUrl}
        invalidateSwitchRequestUrl={invalidateSwitchRequestUrl}
        routes={DEFAULT_ROUTES}
        routeName={headerProps?.routeName ?? null}
        assetUrls={DEFAULT_ASSET_URLS}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
