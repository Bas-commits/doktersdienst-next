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
        description="Bekijk de activiteitenplanning per deelnemer en dagdeel. Wijzigen is niet mogelijk."
      >
        {(context) => <ActivitiesContent {...context} readOnly />}
      </PraktijkplannerPage>
    </>
  );
}
