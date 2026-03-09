'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { WaarneemgroepenList } from '@/components/waarneemgroepen-list';
import { Button } from '@/components/ui/button';

export default function WaarneemgroepenPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.replace('/login');
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <>
        <Head>
          <title>Waarneemgroepen | Doktersdienst</title>
        </Head>
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
          <p className="text-muted-foreground">Laden…</p>
        </main>
      </>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Waarneemgroepen | Doktersdienst</title>
      </Head>
      <main className="flex min-h-screen flex-col items-center p-4 pt-8">
        <div className="mb-6 flex w-full max-w-4xl items-center justify-between">
          <h1 className="text-2xl font-semibold">Waarneemgroepen</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {session.user.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => authClient.signOut()}
            >
              Uitloggen
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>
        <WaarneemgroepenList />
      </main>
    </>
  );
}
