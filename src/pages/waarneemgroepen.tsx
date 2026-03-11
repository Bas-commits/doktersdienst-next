'use client';

import Head from 'next/head';
import Link from 'next/link';
import { WaarneemgroepenList } from '@/components/waarneemgroepen-list';

export default function WaarneemgroepenPage() {
  return (
    <>
      <Head>
        <title>Waarneemgroepen | Doktersdienst</title>
      </Head>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex w-full items-center justify-between">
          <h1 className="text-2xl font-semibold">Waarneemgroepen</h1>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Naar dashboard
          </Link>
        </div>
        <WaarneemgroepenList />
      </div>
    </>
  );
}
