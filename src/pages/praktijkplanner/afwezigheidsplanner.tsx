import Head from 'next/head';
import { PlannerAbsenceEditor } from '@/components/praktijkplanner/PlannerAbsenceEditor';
import { PraktijkplannerPage } from '@/components/praktijkplanner/PraktijkplannerPage';

export default function AfwezigheidsplannerPage() {
  return (
    <>
      <Head>
        <title>Afwezigheidsplanner | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage
        title="Afwezigheidsplanner"
        description="Beheer de afwezigheden van alle deelnemers in de geselecteerde waarneemgroep."
      >
        {(context) =>
          context.data.isManager ? (
            <PlannerAbsenceEditor context={context} view="week" />
          ) : (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Deze planner is alleen beschikbaar voor secretarissen en beheerders.
            </p>
          )
        }
      </PraktijkplannerPage>
    </>
  );
}
