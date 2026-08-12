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
      >
        {(context) =>
          context.data.isManager ? (
            <PlannerAbsenceEditor context={context} mode="manager" />
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
