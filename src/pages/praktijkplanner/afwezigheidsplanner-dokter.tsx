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
        description="Registreer uw afwezigheden per dagdeel in de maandweergave."
      >
        {(context) => <PlannerAbsenceEditor context={context} view="month" />}
      </PraktijkplannerPage>
    </>
  );
}
