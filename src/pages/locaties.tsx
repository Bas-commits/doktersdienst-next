'use client';

import dynamic from 'next/dynamic';
import Head from 'next/head';

const LocationsMap = dynamic(
  () => import('@/components/locations/LocationsMap').then((mod) => mod.LocationsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-muted-foreground" role="status">
        Kaart laden…
      </div>
    ),
  }
);

export default function LocatiesPage() {
  return (
    <>
      <Head>
        <title>Locaties | Doktersdienst</title>
      </Head>
      <div className="h-[calc(100dvh-3.5rem)]">
        <LocationsMap />
      </div>
    </>
  );
}
