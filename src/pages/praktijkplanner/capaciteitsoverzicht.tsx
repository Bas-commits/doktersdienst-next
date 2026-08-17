'use client';

import Head from 'next/head';
import {
  CapacityLocatieKeuze,
  CapacityOverviewGrid,
  CapacityRegimeRegel,
  useCapacityOverview,
} from '@/components/praktijkplanner/CapacityOverview';
import { PlannerWeekBar } from '@/components/praktijkplanner/PlannerWeekBar';
import { usePlannerWeergave } from '@/hooks/praktijkplanner/usePlannerWeergave';
import {
  PraktijkplannerPage,
  PraktijkplannerTitleAside,
  type PraktijkplannerPageContext,
} from '@/components/praktijkplanner/PraktijkplannerPage';

function CapacityOverviewContent({ groupId, data }: PraktijkplannerPageContext) {
  // Dit scherm heeft geen nevenscherm: het is er zelf een. Alleen de week doet hier iets.
  const { weekStart, setWeekStart } = usePlannerWeergave(groupId);
  const { cells, loading, locationId, setLocationId, weekRegime } = useCapacityOverview(
    groupId,
    data,
    weekStart
  );

  if (!data.isManager) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Deze pagina is alleen beschikbaar voor secretarissen en beheerders.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/*
        Weekbalk en locatiekeuze staan samen in de paginakop, net als op de andere
        roosterschermen. De locatie hoort naast de weken: het is een filter op wat je hier
        ziet, net als de week die je kiest.
      */}
      <PraktijkplannerTitleAside>
        <PlannerWeekBar weekStart={weekStart} onWeekStartChange={setWeekStart} />
        <CapacityLocatieKeuze
          locations={data.masterData.locations}
          value={locationId}
          onChange={setLocationId}
        />
      </PraktijkplannerTitleAside>

      {data.masterData.locations.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Voeg eerst een plannerlocatie toe in Plannerbeheer.
        </p>
      ) : (
        <>
          {loading ? <p className="text-sm text-muted-foreground">Overzicht laden…</p> : null}
          <CapacityRegimeRegel regime={weekRegime} />
          <CapacityOverviewGrid data={data} weekStart={weekStart} cells={cells} />
        </>
      )}
    </div>
  );
}

export default function CapaciteitsoverzichtPage() {
  return (
    <>
      <Head>
        <title>Capaciteit overzicht | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage
        title="Capaciteit overzicht"
      >
        {(context) => <CapacityOverviewContent {...context} />}
      </PraktijkplannerPage>
    </>
  );
}
