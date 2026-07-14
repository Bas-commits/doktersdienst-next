import Head from 'next/head';
import { PlannerAbsenceEditor } from '@/components/praktijkplanner/PlannerAbsenceEditor';
import { PraktijkplannerPage } from '@/components/praktijkplanner/PraktijkplannerPage';

export default function AfwezigheidsplannerDokterPage() {
  return (
    <>
      <Head>
        <title>Afwezigheidsplanner dokter | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage
        title="Afwezigheidsplanner dokter"
        description="Geef uw voorlopige afwezigheden per dagdeel door in de maandweergave."
      >
        {(context) => <PlannerAbsenceEditor context={context} mode="doctor" />}
      </PraktijkplannerPage>
    </>
  );
}
