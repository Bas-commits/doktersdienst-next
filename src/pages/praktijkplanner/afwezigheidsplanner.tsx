import Head from 'next/head';
import { PlannerAbsenceEditor } from '@/components/praktijkplanner/PlannerAbsenceEditor';
import { PraktijkplannerPage } from '@/components/praktijkplanner/PraktijkplannerPage';
import {
  afwezigheidsplannerTitel,
  groepPlantDiensten,
} from '@/lib/praktijkplanner/diensten-in-groep';

export default function AfwezigheidsplannerPage() {
  return (
    <PraktijkplannerPage
      title={(data) => afwezigheidsplannerTitel(groepPlantDiensten(data?.masterData.tasks ?? []))}
    >
      {(context) => {
        const titel = afwezigheidsplannerTitel(groepPlantDiensten(context.data.masterData.tasks));
        return (
          <>
            {/*
              De tabbladnaam volgt de kop van het scherm, dus hij staat hier binnen en niet
              erbuiten: pas hier is bekend of deze waarneemgroep diensten als taak plant. Zelfde
              opzet als afwezigheidsplanner-dokter.tsx.
            */}
            <Head>
              <title>{`${titel} | Praktijkplanner`}</title>
            </Head>
            {context.data.isManager ? (
              <PlannerAbsenceEditor context={context} mode="manager" />
            ) : (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Deze planner is alleen beschikbaar voor secretarissen en beheerders.
              </p>
            )}
          </>
        );
      }}
    </PraktijkplannerPage>
  );
}
