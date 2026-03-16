'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { authClient } from '@/lib/auth-client';
import { DoktersdienstHeader } from '@/components/header/DoktersdienstHeader';
import { Sidebar } from '@/components/layout/Sidebar';
import { WaarneemgroepProvider } from '@/contexts/WaarneemgroepContext';
import {
  DEFAULT_ASSET_URLS,
  DEFAULT_ROUTES,
  headerUserFromSession,
  EMPTY_WAARNEMGROEPEN,
} from '@/lib/header-defaults';

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
    <WaarneemgroepProvider>
      <div className="flex min-h-screen flex-col">
        <DoktersdienstHeader
          waarneemgroepen={fallbackWaarneemgroepen}
          headerUser={headerUser}
          routes={DEFAULT_ROUTES}
          routeName={headerProps?.routeName ?? null}
          assetUrls={DEFAULT_ASSET_URLS}
        />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </WaarneemgroepProvider>
  );
}
