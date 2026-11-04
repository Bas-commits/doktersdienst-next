'use client';

import Head from 'next/head';
import { PraktijkplannerPage } from '@/components/praktijkplanner/PraktijkplannerPage';
import { ActivitiesContent } from './activiteiten';

export default function RoosterInzienPage() {
  return (
    <>
      <Head>
        <title>Rooster inzien | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage
        title="Rooster inzien"
      >
        {(context) => <ActivitiesContent {...context} readOnly />}
      </PraktijkplannerPage>
    </>
  );
}
