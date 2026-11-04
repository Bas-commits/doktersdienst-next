import Head from 'next/head';
import { PlannerAbsenceEditor } from '@/components/praktijkplanner/PlannerAbsenceEditor';
import { PraktijkplannerPage } from '@/components/praktijkplanner/PraktijkplannerPage';
import {
  dokterAfwezigheidsschermTitel,
  groepPlantDiensten,
} from '@/lib/praktijkplanner/diensten-in-groep';

export default function AfwezigheidsplannerDokterPage() {
  return (
    <PraktijkplannerPage
      title={(data) =>
        dokterAfwezigheidsschermTitel(groepPlantDiensten(data?.masterData.tasks ?? []))
      }
    >
      {(context) => {
        const titel = dokterAfwezigheidsschermTitel(
          groepPlantDiensten(context.data.masterData.tasks)
        );
        return (
          <>
            {/*
              De tabbladnaam volgt de kop van het scherm, dus hij staat hier binnen en niet
              erbuiten: pas hier is bekend of deze waarneemgroep diensten als taak plant.
            */}
            <Head>
              <title>{`${titel} | Praktijkplanner`}</title>
            </Head>
            <PlannerAbsenceEditor context={context} mode="doctor" />
          </>
        );
      }}
    </PraktijkplannerPage>
  );
}
