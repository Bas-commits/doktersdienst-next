'use client';

import { PlannerWeekendToggle } from '@/components/praktijkplanner/PlannerWeekendToggle';
import { useWeekendVoorkeur } from '@/hooks/praktijkplanner/useWeekendVerbergen';
import Head from 'next/head';
import {
  CapacityLocatieKeuze,
  CapacityOverviewGrid,
  CapacityRegimeRegel,
  useCapacityOverview,
} from '@/components/praktijkplanner/CapacityOverview';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { PlannerWeekBar } from '@/components/praktijkplanner/PlannerWeekBar';
import { usePlannerWeergave } from '@/hooks/praktijkplanner/usePlannerWeergave';
import { downloadCapaciteitsoverzicht } from '@/lib/capaciteitsoverzicht-export';
import { naamVoorBestandsnaam } from '@/lib/excel-export';
import { addDays } from '@/lib/praktijkplanner/dates';
import {
  PraktijkplannerPage,
  PraktijkplannerTitleAside,
  type PraktijkplannerPageContext,
} from '@/components/praktijkplanner/PraktijkplannerPage';

function CapacityOverviewContent({ groupId, data }: PraktijkplannerPageContext) {
  // Dit scherm heeft geen nevenscherm: het is er zelf een. Alleen de week doet hier iets.
  const { weekStart, setWeekStart } = usePlannerWeergave(groupId);
  const { weekendVerborgen, setWeekendVerborgen } = useWeekendVoorkeur(groupId);
  const { cells, loading, locationId, setLocationId, weekRegime } = useCapacityOverview(
    groupId,
    data,
    weekStart
  );

  const [downloading, setDownloading] = useState(false);

  const locatieNaam =
    data.masterData.locations.find((location) => location.id === locationId)?.naam ?? 'locatie';

  /** Zet deze week op deze locatie in een Excel-bestand. */
  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadCapaciteitsoverzicht({
        bestandsnaam: `capaciteitsoverzicht-${naamVoorBestandsnaam(locatieNaam)}-${weekStart}.xlsx`,
        locatie: locatieNaam,
        weekStart,
        weekEnd: addDays(weekStart, 6),
        regime: weekRegime,
        cellen: cells,
      });
    } finally {
      setDownloading(false);
    }
  }

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
        <PlannerWeekendToggle
          getoond={!weekendVerborgen}
          onChange={(getoond) => setWeekendVerborgen(!getoond)}
        />
        <CapacityLocatieKeuze
          locations={data.masterData.locations}
          value={locationId}
          onChange={setLocationId}
        />
        {/* Naast de locatiekeuze, want week en locatie samen zijn wat er in het bestand komt. */}
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={loading || downloading || cells.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded border bg-background px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          title={
            cells.length === 0
              ? 'Niets te exporteren in deze week'
              : 'Download deze week als Excel-bestand'
          }
        >
          <Download className="size-4" aria-hidden />
          Download Excel
        </button>
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
