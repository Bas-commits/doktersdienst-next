'use client';

import Head from 'next/head';
import { useDeelnemerDisplayName } from '@/contexts/DeelnemerProfileContext';

export default function DashboardPage() {
  const name = useDeelnemerDisplayName();

  return (
    <>
      <Head>
        <title>Dashboard | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <section
          className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
          aria-labelledby="welcome-heading"
        >
          <h1 id="welcome-heading" className="text-2xl font-semibold tracking-tight">
            Welkom, {name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Je bent ingelogd bij Doktersdienst. Gebruik het menu om naar waarneemgroepen of andere onderdelen te gaan.
          </p>
        </section>
      </div>
    </>
  );
}
