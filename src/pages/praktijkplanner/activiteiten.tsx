'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Repeat, SendHorizontal, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { AbsenceDaypartCell } from '@/components/praktijkplanner/AbsenceDaypartCell';
import { CapacityOverviewPanel } from '@/components/praktijkplanner/CapacityOverview';
import { LocatieSpecialismenPanel } from '@/components/praktijkplanner/LocatieSpecialismenPanel';
import { PlannerActivityAssignmentBuilder } from '@/components/praktijkplanner/PlannerActivityAssignmentBuilder';
import { PlannerAvondNachtToggle } from '@/components/praktijkplanner/PlannerAvondNachtToggle';
import {
  PlannerCombinedDaypartChip,
  type PlannerDaypartChipItem,
} from '@/components/praktijkplanner/PlannerCombinedDaypartChip';
import type { PlannerCursorTool } from '@/components/praktijkplanner/PlannerCursorTool';
import { PlannerCopyWeekModal } from '@/components/praktijkplanner/PlannerCopyWeekModal';
import { PlannerDaypartGrid } from '@/components/praktijkplanner/PlannerDaypartGrid';
import { PlannerDaypartHoverPreview } from '@/components/praktijkplanner/PlannerDaypartHoverPreview';
import { PlannerManageHerhalingModal } from '@/components/praktijkplanner/PlannerManageHerhalingModal';
import { PlannerMonthOverviewGrid } from '@/components/praktijkplanner/PlannerMonthOverviewGrid';
import { PlannerNotifyPlanningModal } from '@/components/praktijkplanner/PlannerNotifyPlanningModal';
import { PlannerRepeatWeekModal } from '@/components/praktijkplanner/PlannerRepeatWeekModal';
import { PlannerNevenschermKeuze } from '@/components/praktijkplanner/PlannerNevenschermKeuze';
import { PlannerWeekBar } from '@/components/praktijkplanner/PlannerWeekBar';
import { PraktijkplannerPage, PraktijkplannerTitleAside, type PraktijkplannerPageContext } from '@/components/praktijkplanner/PraktijkplannerPage';
import {
  PALET_BREEDTE_PX,
  PANEEL_DREMPEL_PX,
  WEEK_MINIMUM_PX,
  useBeschikbareBreedte,
} from '@/hooks/praktijkplanner/useBeschikbareBreedte';
import { usePlannerHolidays } from '@/hooks/praktijkplanner/usePlannerHolidays';
import { usePlannerWeergave } from '@/hooks/praktijkplanner/usePlannerWeergave';
import {
  buildActivityAssignmentSlot,
  getMissingActivityExpertiseWarning,
  getMissingTaskExpertiseWarnings,
  hasActivityAssignmentSelection,
  type ActivityAssignmentSelection,
  type CurrentActivityAssignment,
} from '@/lib/praktijkplanner/activity-assignment';
import { activiteitenIconPath } from '@/lib/praktijkplanner/activiteiten-iconen';
import {
  zichtbareDagdelen,
} from '@/lib/praktijkplanner/dagdeel-zichtbaarheid';
import { deelnemerChipInitials, deelnemerRoosterNaam } from '@/lib/deelnemer-display';
import {
  addDays,
  maandVanWeek,
  monthBounds,
  weekDates,
  weekRangeLabel,
  weekdayFromIsoDate,
} from '@/lib/praktijkplanner/dates';
import { downloadPlannerRooster } from '@/lib/praktijkplanner/rooster-export';
import { absentieTekst } from '@/lib/praktijkplanner/absentie-tekst';
import { afwijkingTekst } from '@/lib/praktijkplanner/herhaling-tekst';
import {
  volledigeActiviteitNaam,
  volledigeTaakNaam,
} from '@/lib/praktijkplanner/volledige-naam';
import {
  notifyPlannerChanged,
  subscribePlannerChanged,
} from '@/lib/praktijkplanner/planner-change-broadcast';
import {
  dagdelenZonderRooster,
  isDaypartSchedulableForParticipant,
  participantMatrixFor,
  weekdagenZonderRooster,
} from '@/lib/praktijkplanner/schedulable-dayparts';
import type {
  PraktijkplannerAbsenceSlot,
  PraktijkplannerParticipant,
  PraktijkplannerPlanningSlot,
} from '@/types/praktijkplanner';

type ParticipantActionModal =
  | { type: 'copy'; participant: PraktijkplannerParticipant; sourceWeekStart: string }
  | { type: 'repeat'; participant: PraktijkplannerParticipant; sourceWeekStart: string }
  | { type: 'email'; participant: PraktijkplannerParticipant }
  | { type: 'manageHerhaling'; participant: PraktijkplannerParticipant };

/** Same format as lijst deelnemers: achternaam, voornaam, voorletterstussenvoegsel */
function participantDisplayName(participant: PraktijkplannerParticipant): string {
  return deelnemerRoosterNaam(participant);
}

function slotKey(iddeelnemer: number, datum: string, iddagdeel: number) {
  return `${iddeelnemer}:${datum}:${iddagdeel}`;
}

export function ActivitiesContent({
  groupId,
  data,
  readOnly = false,
}: PraktijkplannerPageContext & { readOnly?: boolean }) {
  const router = useRouter();
  const canEdit = data.isManager && !readOnly;
  const { weekStart, setWeekStart, nevenscherm, setNevenscherm } = usePlannerWeergave(groupId);
  // De rij waar palet, week en paneel in staan. De breedte daarvan hangt niet af van wat er
  // in komt te staan, dus de meting kan zichzelf niet achterna lopen.
  const roosterRij = useRef<HTMLDivElement>(null);
  const beschikbareBreedte = useBeschikbareBreedte(roosterRij);
  const [slots, setSlots] = useState<PraktijkplannerPlanningSlot[]>([]);
  const [absenceSlots, setAbsenceSlots] = useState<PraktijkplannerAbsenceSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [selectedSpecificationId, setSelectedSpecificationId] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<number | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [clearMode, setClearMode] = useState(false);
  const [showNight, setShowNight] = useState(false);
  const [participantFilter, setParticipantFilter] = useState<number | 'all'>('all');
  const [zoom, setZoom] = useState('100');
  const [actionModal, setActionModal] = useState<ParticipantActionModal | null>(null);

  const end = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const monthAnchor = useMemo(() => maandVanWeek(weekStart), [weekStart]);
  const monthRange = useMemo(
    () => monthBounds(monthAnchor.year, monthAnchor.month),
    [monthAnchor]
  );
  // De maand haalt een hele maand op, ook als hij naast de week staat: het paneel toont dan
  // dezelfde maand, alleen smaller.
  const toontMaand = nevenscherm === 'maand';
  const rangeStart = toontMaand && monthRange ? monthRange.start : weekStart;
  const rangeEnd = toontMaand && monthRange ? monthRange.end : end;

  /*
    Links staat de week, rechts de keuze. Past dat niet naast elkaar, dan komt de keuze in de
    plaats van de week; zo blijft alles bereikbaar op een laptop zonder een melding die de
    lezer toch niet kan verhelpen.

    Het palet gaat van de beschikbare ruimte af, dus dat wordt er hier afgetrokken in plaats
    van gemeten. Zie useBeschikbareBreedte voor waarom meten hier zou gaan flikkeren.
  */
  const naastElkaar =
    beschikbareBreedte - (canEdit ? PALET_BREEDTE_PX : 0) >= PANEEL_DREMPEL_PX;
  /*
    Wat er in het paneel komt, of niets. Niet hetzelfde als de knop: een keuze die dit scherm
    niet kan tonen valt hier terug op niets, en dan blijft de week gewoon staan in plaats van
    dat er een lege kolom naast komt. Dat gebeurt als een ander venster een keuze doorgeeft
    die deze gebruiker niet mag zien.
  */
  const paneel =
    toontMaand
      ? 'maand'
      : nevenscherm === 'locatie'
        ? 'locatie'
        : nevenscherm === 'capaciteit' && data.isManager
          ? 'capaciteit'
          : null;
  const toontWeek = paneel === null || naastElkaar;

  // In een cel van 34 pixels is geen fiche neer te zetten, dus de maand is altijd om te
  // kijken. Het palet hoort bij de week: staat die er niet, dan is er niets om het op te
  // laten vallen.
  const showsPalette = canEdit && toontWeek;

  const holidays = usePlannerHolidays(rangeStart, rangeEnd);
  const visibleParticipants = useMemo(
    () =>
      participantFilter === 'all'
        ? data.participants
        : data.participants.filter((participant) => participant.id === participantFilter),
    [data.participants, participantFilter]
  );
  const verborgenWeekdagen = useMemo(
    () => weekdagenZonderRooster(data.masterData.schedulableDayparts ?? []),
    [data.masterData.schedulableDayparts]
  );
  const visibleDayparts = useMemo(() => {
    const weg = dagdelenZonderRooster(
      data.masterData.schedulableDayparts ?? [],
      data.masterData.dayparts.map((daypart) => daypart.id)
    );
    return zichtbareDagdelen(
      data.masterData.dayparts.filter((daypart) => !weg.has(daypart.id)),
      { toonAvondNacht: showNight }
    );
  }, [data.masterData.dayparts, data.masterData.schedulableDayparts, showNight]);

  useEffect(() => {
    setSelectedSpecificationId((current) => {
      if (current == null) return null;
      return data.masterData.specifications.some(
        (specification) =>
          specification.id === current && specification.idactiviteit === selectedActivityId
      )
        ? current
        : null;
    });
  }, [data.masterData.specifications, selectedActivityId]);

  useEffect(() => {
    const abortController = new AbortController();
    fetch(`/api/praktijkplanner/voorkeuren?idwaarneemgroep=${groupId}`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { toonNacht?: boolean };
        if (!response.ok) return;
        if (typeof payload.toonNacht === 'boolean') setShowNight(payload.toonNacht);
      })
      .catch(() => undefined);
    return () => abortController.abort();
  }, [groupId]);

  // toonDag gaat altijd als true mee: ochtend en middag zijn niet meer uit te zetten, want
  // een rooster zonder de dagdelen waar bijna alles in staat is geen rooster. De kolom blijft
  // in de API en in de tabel staan, hij heeft alleen geen betekenis meer.
  const updateVisibility = useCallback(
    (nextNight: boolean) => {
      setShowNight(nextNight);
      void fetch('/api/praktijkplanner/voorkeuren', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          toonDag: true,
          toonNacht: nextNight,
        }),
      });
    },
    [groupId]
  );

  const loadSlots = useCallback(() => {
    const abortController = new AbortController();
    setLoadingSlots(true);
    setSlotError(null);
    fetch(
      `/api/praktijkplanner/activiteiten?idwaarneemgroep=${groupId}&start=${rangeStart}&end=${rangeEnd}`,
      { credentials: 'include', signal: abortController.signal }
    )
      .then(async (response) => {
        const payload = (await response.json()) as { slots?: PraktijkplannerPlanningSlot[]; error?: string };
        if (!response.ok || !payload.slots) {
          throw new Error(payload.error || 'De activiteitenplanning kon niet worden geladen.');
        }
        return payload.slots;
      })
      .then((loaded) => {
        if (!abortController.signal.aborted) setSlots(loaded);
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          setSlotError(error instanceof Error ? error.message : 'De activiteitenplanning kon niet worden geladen.');
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoadingSlots(false);
      });
    return () => abortController.abort();
  }, [groupId, rangeEnd, rangeStart]);

  const refreshSlots = useCallback(async () => {
    const response = await fetch(
      `/api/praktijkplanner/activiteiten?idwaarneemgroep=${groupId}&start=${rangeStart}&end=${rangeEnd}`,
      { credentials: 'include' }
    );
    const payload = (await response.json()) as { slots?: PraktijkplannerPlanningSlot[]; error?: string };
    if (!response.ok || !payload.slots) {
      throw new Error(payload.error || 'De activiteitenplanning kon niet worden geladen.');
    }
    setSlots(payload.slots);
  }, [groupId, rangeEnd, rangeStart]);

  const loadAbsences = useCallback(() => {
    const abortController = new AbortController();
    fetch(
      `/api/praktijkplanner/afwezigheden?idwaarneemgroep=${groupId}&start=${rangeStart}&end=${rangeEnd}`,
      { credentials: 'include', signal: abortController.signal }
    )
      .then(async (response) => {
        const payload = (await response.json()) as { slots?: PraktijkplannerAbsenceSlot[]; error?: string };
        if (!response.ok || !payload.slots) {
          throw new Error(payload.error || 'Afwezigheden konden niet worden geladen.');
        }
        return payload.slots;
      })
      .then((loaded) => {
        if (!abortController.signal.aborted) setAbsenceSlots(loaded);
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          toast.error(error instanceof Error ? error.message : 'Afwezigheden konden niet worden geladen.');
        }
      });
    return () => abortController.abort();
  }, [groupId, rangeEnd, rangeStart]);

  useEffect(() => loadSlots(), [loadSlots]);
  useEffect(() => loadAbsences(), [loadAbsences]);

  useEffect(() => {
    let debounceTimer: number | undefined;
    const scheduleRefresh = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        void refreshSlots();
        loadAbsences();
      }, 300);
    };

    const unsubscribe = subscribePlannerChanged(groupId, scheduleRefresh);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsubscribe();
      window.clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [groupId, loadAbsences, refreshSlots]);

  /*
    De dagen die het raster toont: de week, min de weekdagen waar de groep nooit op werkt. Wat
    je downloadt hoort te zijn wat je ziet, dus dit is dezelfde lijst als de kolommen.

    De week en niet de maand, ook als het maandpaneel ernaast staat. Dat paneel is er om te
    kijken; de week is waar de knop bij hoort en wat de bestandsnaam kan dragen.
  */
  const exportDatums = useMemo(
    () => weekDates(weekStart).filter((datum) => !verborgenWeekdagen.has(weekdayFromIsoDate(datum))),
    [weekStart, verborgenWeekdagen]
  );
  const [downloading, setDownloading] = useState(false);

  /** Zet de getoonde week in een Excel-bestand, met de dokters en dagdelen die op het scherm staan. */
  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadPlannerRooster({
        bestandsnaam: `praktijkplanner-rooster-${weekStart}.xlsx`,
        kop: `Rooster ${weekRangeLabel(weekStart, { withYear: true })}`,
        datums: exportDatums,
        dagdelen: visibleDayparts.map((daypart) => ({ id: daypart.id, naam: daypart.naam })),
        deelnemers: visibleParticipants.map((participant) => ({
          id: participant.id,
          naam: participantDisplayName(participant),
        })),
        slots,
        absences: absenceSlots,
      });
    } finally {
      setDownloading(false);
    }
  }

  const baseSlotMap = useMemo(
    () => new Map(slots.map((slot) => [slotKey(slot.iddeelnemer, slot.datum, slot.iddagdeel), slot])),
    [slots]
  );

  const absenceMap = useMemo(
    () =>
      new Map(
        absenceSlots.map((slot) => [slotKey(slot.iddeelnemer, slot.datum, slot.iddagdeel), slot])
      ),
    [absenceSlots]
  );

  // Een aanvraag is nog geen afwezigheid. Alleen een vastgelegde afwezigheid haalt de dokter
  // uit de telling van het locatiepaneel; anders verdwijnt hij uit het overzicht op het moment
  // dat hij vakantie vraagt, terwijl er nog niets besloten is.
  const isAfwezig = useCallback(
    (iddeelnemer: number, datum: string, iddagdeel: number) =>
      absenceMap.get(slotKey(iddeelnemer, datum, iddagdeel))?.isVoorlopig === false,
    [absenceMap]
  );

  const renderSlot = useCallback(
    ({
      participant,
      datum,
      daypart,
      hoverEnabled,
      variant = 'week',
    }: {
      participant: PraktijkplannerParticipant;
      datum: string;
      daypart: { id: number; naam: string };
      hoverEnabled: boolean;
      /**
       * In de maandweergave is een vakje 34 bij 34 pixels in plaats van 56 bij 56. Dezelfde
       * fiche dus, alleen kleiner getekend: zonder de namen in de banden en zonder het bolletje
       * met de initialen, want daar is bij die maat geen ruimte voor.
       */
      variant?: 'week' | 'month';
    }) => {
      const key = slotKey(participant.id, datum, daypart.id);
      const existing = baseSlotMap.get(key);
      const absence = absenceMap.get(key);
      const activity = existing?.activity ?? null;
      const specification = existing?.specification ?? null;
      const location = existing?.location ?? null;
      const tasks = existing?.tasks ?? [];
      const availability = existing?.availability ?? null;
      const initials = deelnemerChipInitials(participant);
      const participantName = participantDisplayName(participant);
      const hasActivityContent = Boolean(
        activity || location || tasks.length > 0 || availability
      );

      // Zo'n dagdeel is niets anders dan de absentie zelf, dus daar is de hoverkaart juist
      // het enige dat vertelt wie het is en wat er staat.
      if (absence && (!absence.isVoorlopig || !hasActivityContent)) {
        const provisional = absence.isVoorlopig;
        const cell = (
          <AbsenceDaypartCell
            absence={absence.absenceType}
            provisional={provisional}
            participantColor={participant.color}
            fill
          />
        );
        return (
          <PlannerDaypartHoverPreview
            enabled={hoverEnabled}
            participantName={participantName}
            initials={initials}
            datum={datum}
            daypartName={daypart.naam}
            fromRepetition={false}
            isException={false}
            absence={{ type: absence.absenceType.naam, aangevraagd: provisional }}
            showPlanningDetails={false}
            chip={<div className="relative h-full w-full">{cell}</div>}
          >
            {cell}
          </PlannerDaypartHoverPreview>
        );
      }

      if (!hasActivityContent) {
        return null;
      }

      const taskItems: PlannerDaypartChipItem[] = tasks.flatMap((task) =>
        task
          ? [
              {
                id: task.id,
                label: task.afkorting || task.omschrijving || `Taak ${task.id}`,
                color: task.kleur,
                inbelbaar: task.inbelbaar,
              },
            ]
          : []
      );
      const activityItem: PlannerDaypartChipItem | null = activity
        ? {
            id: activity.id,
            label: [
              activity.afkorting || activity.naam,
              specification ? specification.afkorting || specification.naam : null,
            ]
              .filter(Boolean)
              .join(' · '),
            color: specification?.kleur || activity.kleur,
            icon: activiteitenIconPath(activity.icon),
          }
        : null;
      const locationItem: PlannerDaypartChipItem | null = location
        ? {
            id: location.id,
            label: location.afkorting || location.naam,
            color: location.kleur,
          }
        : null;

      const provisionalOverlay = Boolean(absence?.isVoorlopig);
      const absenceTypeName = absence?.absenceType.naam ?? null;
      // De bordjes staan bovenop de fiche. Op de helft van de maat moeten ze mee krimpen,
      // anders dekt een vraagteken van zestien pixels het halve vakje af.
      const isMaand = variant === 'month';
      const provisionalBadge = (
        <span
          className={[
            'pointer-events-none absolute top-0.5 right-0.5 z-20 flex items-center justify-center rounded bg-background/90 font-bold text-muted-foreground ring-1 ring-border',
            isMaand ? 'size-2.5 text-[8px]' : 'size-4 text-[11px]',
          ].join(' ')}
          title={absentieTekst(absenceTypeName, true)}
        >
          ?
        </span>
      );

      const chip = (
        <div className="relative h-full w-full min-w-0">
          <div
            className={[
              'relative h-full w-full min-w-0',
              provisionalOverlay ? 'opacity-45 grayscale' : null,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {activityItem || locationItem || taskItems.length > 0 ? (
              <PlannerCombinedDaypartChip
                tasks={taskItems}
                activity={activityItem}
                location={locationItem}
                fill
                participantColor={participant.color}
                initials={initials}
                density={isMaand ? 'micro' : 'compact'}
                className="shadow-none"
              />
            ) : null}
            {availability ? (
              <span
                className={[
                  'pointer-events-none absolute inset-x-0.5 bottom-0.5 truncate rounded bg-background/80 px-0.5 font-medium text-emerald-700',
                  isMaand ? 'text-[7px] leading-tight' : 'text-[9px]',
                ].join(' ')}
              >
                {availability.naam}
              </span>
            ) : null}
          </div>
          {existing?.isUitzondering ? (
            <span
              className={[
                'pointer-events-none absolute top-0.5 left-0.5 z-20 rounded bg-background/90 text-amber-500',
                isMaand ? 'p-0' : 'p-0.5',
              ].join(' ')}
              title={afwijkingTekst(existing.recurrenceSourceWeek)}
            >
              <TriangleAlert className={isMaand ? 'size-2.5' : 'size-3.5'} aria-hidden />
            </span>
          ) : null}
          {provisionalOverlay ? provisionalBadge : null}
        </div>
      );

      return (
        <PlannerDaypartHoverPreview
          enabled={hoverEnabled}
          participantName={participantName}
          initials={initials}
          datum={datum}
          daypartName={daypart.naam}
          fromRepetition={existing?.recurrenceId != null}
          isException={Boolean(existing?.isUitzondering)}
          recurrenceSourceWeek={existing?.recurrenceSourceWeek ?? null}
          activityName={volledigeActiviteitNaam(activity, specification)}
          locationName={locationItem?.label}
          absence={provisionalOverlay ? { type: absenceTypeName, aangevraagd: true } : null}
          availabilityName={availability?.naam}
          taskNames={tasks.map(volledigeTaakNaam)}
          chip={
            // De fiche in de kaart moet dezelfde fiche zijn als in het rooster. Zonder de
            // grijze sluier en het vraagteken wijst de planner iets aan dat er anders uitziet
            // dan wat hij te zien krijgt.
            <div className="relative h-full w-full">
              <div className={provisionalOverlay ? 'h-full w-full opacity-45 grayscale' : 'h-full w-full'}>
                <PlannerCombinedDaypartChip
                  tasks={taskItems}
                  activity={activityItem}
                  location={locationItem}
                  fill
                  participantColor={participant.color}
                  initials={initials}
                  density="popover"
                  className="shadow-sm"
                />
              </div>
              {provisionalOverlay ? provisionalBadge : null}
            </div>
          }
        >
          {chip}
        </PlannerDaypartHoverPreview>
      );
    },
    [absenceMap, baseSlotMap]
  );

  const isCellFilled = useCallback(
    ({
      participant,
      datum,
      daypart,
    }: {
      participant: { id: number };
      datum: string;
      daypart: { id: number };
    }) => {
      const key = slotKey(participant.id, datum, daypart.id);
      const existing = baseSlotMap.get(key);
      const absence = absenceMap.get(key);
      return Boolean(
        absence ||
          existing?.activity ||
          existing?.location ||
          existing?.availability ||
          existing?.tasks.length
      );
    },
    [absenceMap, baseSlotMap]
  );

  const isCellDisabled = useCallback(
    ({
      participant,
      datum,
      daypart,
    }: {
      participant: { id: number };
      datum: string;
      daypart: { id: number };
    }) => {
      if (!canEdit) return true;
      const absence = absenceMap.get(slotKey(participant.id, datum, daypart.id));
      return Boolean(absence && !absence.isVoorlopig);
    },
    [absenceMap, canEdit]
  );

  /**
   * De taken die de groep als dienst heeft aangemerkt.
   *
   * Een nachtdienst valt per definitie buiten de uren waarop iemand werkt, dus de
   * inroosterbaarheid mag er niet voor gelden. Zonder deze uitzondering is een dienst nergens
   * neer te zetten waar hij hoort.
   */
  const dienstTaakIds = useMemo(
    () => new Set(data.masterData.tasks.filter((taak) => taak.isDienst).map((taak) => taak.id)),
    [data.masterData.tasks]
  );
  const zetDienstNeer = useMemo(
    () => selectedTaskIds.some((id) => dienstTaakIds.has(id)),
    [dienstTaakIds, selectedTaskIds]
  );

  const isCellUnavailable = useCallback(
    ({
      participant,
      datum,
      daypart,
    }: {
      participant: { id: number };
      datum: string;
      daypart: { id: number };
    }) => {
      // Wie een dienst in de hand heeft, of leegmaakt, moet overal kunnen klikken.
      if (zetDienstNeer || clearMode) return false;
      return !isDaypartSchedulableForParticipant(
        data.masterData.schedulableDayparts ?? [],
        participantMatrixFor(data.masterData.participantSchedulableDayparts ?? [], participant.id),
        datum,
        daypart.id
      );
    },
    [
      clearMode,
      data.masterData.participantSchedulableDayparts,
      data.masterData.schedulableDayparts,
      zetDienstNeer,
    ]
  );

  const getCellClassName = useCallback(
    ({
      participant,
      datum,
      daypart,
    }: {
      participant: { id: number };
      datum: string;
      daypart: { id: number };
    }) => {
      const existing = baseSlotMap.get(slotKey(participant.id, datum, daypart.id));
      if (!existing?.isUitzondering) return undefined;
      return 'border-2 border-amber-400 bg-amber-100 enabled:hover:border-amber-500 enabled:hover:bg-amber-100';
    },
    [baseSlotMap]
  );

  const clearSelection = useCallback(() => {
    setClearMode(false);
    setSelectedActivityId(null);
    setSelectedSpecificationId(null);
    setSelectedLocationId(null);
    setSelectedAvailabilityId(null);
    setSelectedTaskIds([]);
  }, []);

  const setAssignmentClearMode = useCallback((enabled: boolean) => {
    setClearMode(enabled);
    if (!enabled) return;
    setSelectedActivityId(null);
    setSelectedSpecificationId(null);
    setSelectedLocationId(null);
    setSelectedAvailabilityId(null);
    setSelectedTaskIds([]);
  }, []);

  const dismissCursorTool = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const cursorTool = useMemo((): PlannerCursorTool | null => {
    if (!canEdit) return null;
    if (clearMode) {
      return {
        icon: <Trash2 className="text-white" aria-hidden />,
        color: '#c91b23',
        label: 'Leegmaken',
      };
    }

    const activity = data.masterData.activities.find((item) => item.id === selectedActivityId);
    const specification = data.masterData.specifications.find(
      (item) => item.id === selectedSpecificationId
    );
    const location = data.masterData.locations.find((item) => item.id === selectedLocationId);
    const availability = data.masterData.availabilityTypes.find(
      (item) => item.id === selectedAvailabilityId
    );
    const tasks = selectedTaskIds.flatMap(
      (id) => data.masterData.tasks.find((task) => task.id === id) ?? []
    );
    if (!activity && !location && !availability && tasks.length === 0) return null;

    const labels = [
      activity
        ? [
            activity.afkorting || activity.naam,
            specification ? specification.afkorting || specification.naam : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : null,
      ...tasks.map((task) => task.afkorting || task.omschrijving),
      location ? location.afkorting || location.naam : null,
      availability ? availability.code || availability.naam : null,
    ].filter(Boolean);
    const icon =
      activiteitenIconPath(activity?.icon) ??
      activiteitenIconPath(availability?.icon) ??
      null;

    return {
      icon,
      color:
        activity?.kleur ??
        availability?.kleur ??
        location?.kleur ??
        tasks[0]?.kleur ??
        '#64748b',
      label: labels.join(' · '),
      preview:
        activity || location || tasks.length > 0 ? (
          <PlannerCombinedDaypartChip
            tasks={tasks.map((task) => ({
              id: task.id,
              label: task.afkorting || task.omschrijving || `Taak ${task.id}`,
              color: task.kleur,
              inbelbaar: task.inbelbaar,
            }))}
            activity={
              activity
                ? {
                    id: activity.id,
                    label: [
                      activity.afkorting || activity.naam,
                      specification ? specification.afkorting || specification.naam : null,
                    ]
                      .filter(Boolean)
                      .join(' · '),
                    color: specification?.kleur || activity.kleur,
                    icon: activiteitenIconPath(activity.icon),
                  }
                : null
            }
            location={
              location
                ? {
                    id: location.id,
                    label: location.afkorting || location.naam,
                    color: location.kleur,
                  }
                : null
            }
            className="w-28 ring-2 ring-white/80"
          />
        ) : undefined,
    };
  }, [
    canEdit,
    clearMode,
    data.masterData.activities,
    data.masterData.availabilityTypes,
    data.masterData.locations,
    data.masterData.specifications,
    data.masterData.tasks,
    selectedActivityId,
    selectedAvailabilityId,
    selectedLocationId,
    selectedSpecificationId,
    selectedTaskIds,
  ]);

  const queueCell = useCallback(
    async ({
      participant,
      datum,
      daypart,
    }: {
      participant: PraktijkplannerParticipant;
      datum: string;
      daypart: { id: number };
    }) => {
      if (!canEdit) {
        toast.info('Alleen secretarissen en beheerders kunnen de activiteitenplanning aanpassen.');
        return;
      }
      if (
        !zetDienstNeer &&
        !clearMode &&
        !isDaypartSchedulableForParticipant(
          data.masterData.schedulableDayparts ?? [],
          participantMatrixFor(data.masterData.participantSchedulableDayparts ?? [], participant.id),
          datum,
          daypart.id
        )
      ) {
        return;
      }
      const key = slotKey(participant.id, datum, daypart.id);
      const confirmedAbsence = absenceMap.get(key);
      if (confirmedAbsence && !confirmedAbsence.isVoorlopig) {
        toast.info('Dit dagdeel heeft een bevestigde afwezigheid en kan niet worden aangepast.');
        return;
      }
      const existingSlot = baseSlotMap.get(key);
      const currentAssignment: CurrentActivityAssignment | null = existingSlot
        ? {
            idactiviteit: existingSlot.idactiviteit,
            idactiviteitspecificatie: existingSlot.idactiviteitspecificatie,
            idplannerlocatie: existingSlot.idplannerlocatie,
            idbeschikbaarheidstype: existingSlot.availability?.id ?? null,
            taskIds: existingSlot.tasks.map((task) => task.id),
            version: existingSlot.version,
          }
        : null;
      const selection: ActivityAssignmentSelection = {
        activityId: selectedActivityId,
        specificationId: selectedSpecificationId,
        taskIds: selectedTaskIds,
        locationId: selectedLocationId,
        availabilityId: selectedAvailabilityId,
      };

      if (!clearMode && !hasActivityAssignmentSelection(selection)) {
        toast.info('Kies eerst een activiteit, locatie, beschikbaarheidstype of taak.');
        return;
      }

      const expertiseWarnings: string[] = [];
      const participantExpertiseIds = (participant.expertises ?? []).map((item) => item.id);

      if (!clearMode && selection.activityId != null) {
        const activity = data.masterData.activities.find((item) => item.id === selection.activityId);
        const warning = getMissingActivityExpertiseWarning({
          activity,
          expertises: data.masterData.expertises,
          participantExpertiseIds,
        });
        if (warning) expertiseWarnings.push(warning);
      }

      if (!clearMode && selection.taskIds.length > 0) {
        const selectedTasks = selection.taskIds.flatMap(
          (id) => data.masterData.tasks.find((task) => task.id === id) ?? []
        );
        expertiseWarnings.push(
          ...getMissingTaskExpertiseWarnings({
            tasks: selectedTasks,
            expertises: data.masterData.expertises,
            participantExpertiseIds,
          })
        );
      }

      const next = buildActivityAssignmentSlot({
        participantId: participant.id,
        date: datum,
        daypartId: daypart.id,
        selection,
        current: currentAssignment,
        clearMode,
      });

      const activity =
        next.idactiviteit != null
          ? data.masterData.activities.find((item) => item.id === next.idactiviteit) ?? null
          : null;
      const specification =
        next.idactiviteitspecificatie != null
          ? data.masterData.specifications.find((item) => item.id === next.idactiviteitspecificatie) ?? null
          : null;
      const location =
        next.idplannerlocatie != null
          ? data.masterData.locations.find((item) => item.id === next.idplannerlocatie) ?? null
          : null;
      const tasks = next.taskIds.flatMap(
        (id, index) => {
          const task = data.masterData.tasks.find((item) => item.id === id);
          return task
            ? [
                {
                  id: task.id,
                  positie: index,
                  afkorting: task.afkorting,
                  omschrijving: task.omschrijving,
                  kleur: task.kleur,
                  inbelbaar: task.inbelbaar,
                },
              ]
            : [];
        }
      );
      const availability =
        next.idbeschikbaarheidstype != null
          ? data.masterData.availabilityTypes.find(
              (item) => item.id === next.idbeschikbaarheidstype
            ) ?? null
          : null;
      const hasAssignment = activity != null || location != null || tasks.length > 0 || availability != null;
      const previousSlots = slots;

      setSlots((current) => {
        const updated = current.filter(
          (slot) => slotKey(slot.iddeelnemer, slot.datum, slot.iddagdeel) !== key
        );
        if (!hasAssignment) return updated;

        updated.push({
          id: existingSlot?.id ?? -1,
          iddeelnemer: participant.id,
          datum,
          iddagdeel: daypart.id,
          idactiviteit: next.idactiviteit,
          idactiviteitspecificatie: next.idactiviteitspecificatie,
          idplannerlocatie: next.idplannerlocatie,
          version: existingSlot?.version ?? 0,
          activity,
          specification,
          location,
          tasks,
          availability,
          recurrenceId: existingSlot?.recurrenceId ?? null,
          isBronslot: existingSlot?.isBronslot ?? null,
          isUitzondering:
            existingSlot?.recurrenceId != null && existingSlot.isBronslot === false
              ? true
              : (existingSlot?.isUitzondering ?? null),
          recurrenceSourceWeek: existingSlot?.recurrenceSourceWeek ?? null,
        });
        return updated;
      });

      try {
        const response = await fetch('/api/praktijkplanner/activiteiten', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idwaarneemgroep: groupId, slots: [next] }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Wijziging kon niet worden opgeslagen.');
        await refreshSlots();
        notifyPlannerChanged(groupId);
        if (expertiseWarnings.length > 0) {
          for (const warning of expertiseWarnings) {
            toast.warning(warning, { duration: 8000 });
          }
        } else {
          toast.success(clearMode ? 'Dagdeel leeggemaakt.' : 'Dagdeel opgeslagen.');
        }
      } catch (error) {
        setSlots(previousSlots);
        toast.error(error instanceof Error ? error.message : 'Wijziging kon niet worden opgeslagen.');
      }
    },
    [
      absenceMap,
      baseSlotMap,
      clearMode,
      canEdit,
      data.masterData.activities,
      data.masterData.availabilityTypes,
      data.masterData.expertises,
      data.masterData.locations,
      data.masterData.participantSchedulableDayparts,
      data.masterData.schedulableDayparts,
      data.masterData.specifications,
      data.masterData.tasks,
      groupId,
      refreshSlots,
      selectedActivityId,
      selectedAvailabilityId,
      selectedLocationId,
      selectedSpecificationId,
      selectedTaskIds,
      slots,
      zetDienstNeer,
    ]
  );

  const refreshAfterRecurrence = useCallback(() => {
    loadSlots();
    notifyPlannerChanged(groupId);
  }, [groupId, loadSlots]);

  const openDeelnemerGegevens = useCallback(
    (participant: PraktijkplannerParticipant) => {
      void router.push(`/mijn-gegevens?deelnemerId=${participant.id}`);
    },
    [router]
  );

  const renderParticipantActions = useCallback(
    (participant: PraktijkplannerParticipant) => (
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Week kopiëren"
          title="Week kopiëren"
          onClick={() =>
            setActionModal({ type: 'copy', participant, sourceWeekStart: weekStart })
          }
        >
          <Copy className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Herhalen"
          title="Herhalen"
          onClick={() =>
            setActionModal({ type: 'repeat', participant, sourceWeekStart: weekStart })
          }
        >
          <Repeat className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Planning per e-mail versturen"
          title="Planning per e-mail versturen"
          onClick={() => setActionModal({ type: 'email', participant })}
        >
          <SendHorizontal className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Herhalingen beheren"
          title="Herhalingen beheren"
          onClick={() => setActionModal({ type: 'manageHerhaling', participant })}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
    ),
    [weekStart]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-4">
      {/*
        De maand- en weekregel staan in de koprij van de pagina, naast de titel. Ze stonden
        boven het rooster en dat kostte twee regels hoogte die de titel al gebruikte.
      */}
      {/*
        Geen extra blok om deze drie heen: dan wikkelen ze als een geheel naar een tweede
        regel zodra er een pixel te weinig is. Los in de koprij schuift alleen het stuk dat
        echt niet meer past.
      */}
      <PraktijkplannerTitleAside>
        <>
          <PlannerWeekBar weekStart={weekStart} onWeekStartChange={setWeekStart} />
          {/*
            De weekbalk blijft ook in de maandweergave de navigatie: een week aanwijzen kiest
            de maand waar die week bij hoort. Twee losse navigaties zouden uit elkaar kunnen
            lopen en dan weet je niet meer welke van de twee je aan het verzetten bent.
          */}
          {/*
            Alleen voor wie plant. Wie het rooster inziet heeft niets aan een lege rij, en
            heeft er ook geen eerste avond in te zetten.
          */}
          {canEdit ? (
            <PlannerAvondNachtToggle aan={showNight} onChange={updateVisibility} />
          ) : null}
          {/*
            Het capaciteitsoverzicht is er alleen voor secretarissen en beheerders, net als de
            eigen pagina ervan. Een knop aanbieden die op een 403 uitloopt is erger dan geen
            knop.
          */}
          <PlannerNevenschermKeuze
            value={nevenscherm}
            onChange={setNevenscherm}
            keuzes={
              data.isManager
                ? ['geen', 'maand', 'capaciteit', 'locatie']
                : ['geen', 'maand', 'locatie']
            }
            naastElkaar={naastElkaar}
          />
          {/*
            De knop staat er ook voor wie het rooster alleen inziet. Een dokter die zijn eigen
            week wil meenemen heeft er evenveel aan als de planner, en het bestand bevat niets
            dat het scherm niet al toont.
          */}
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={loadingSlots || downloading || visibleParticipants.length === 0}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            title="Download deze week als Excel-bestand"
          >
            <Download className="size-4" aria-hidden />
            Download Excel
          </button>
        </>
      </PraktijkplannerTitleAside>

      <div ref={roosterRij} className="flex min-h-0 flex-1 items-stretch gap-4">
        {showsPalette ? (
          <div className="shrink-0 self-stretch">
            {/*
              Vroeger stond het palet vastgeplakt mee te scrollen met de pagina. Nu scrollt
              het rooster zelf en blijft de pagina staan, dus het palet vult gewoon de
              kolomhoogte en scrollt vanbinnen als de lijst langer is.
            */}
            <div className="h-full" data-planner-tool-keep-active>
              <PlannerActivityAssignmentBuilder
                activities={data.masterData.activities}
                specifications={data.masterData.specifications}
                tasks={data.masterData.tasks}
                locations={data.masterData.locations}
                availabilityTypes={data.masterData.availabilityTypes}
                selection={{
                  activityId: selectedActivityId,
                  specificationId: selectedSpecificationId,
                  taskIds: selectedTaskIds,
                  locationId: selectedLocationId,
                  availabilityId: selectedAvailabilityId,
                }}
                clearMode={clearMode}
                onActivityChange={(id) => {
                  setClearMode(false);
                  setSelectedActivityId(id);
                  setSelectedSpecificationId(null);
                }}
                onSpecificationChange={(id) => {
                  setClearMode(false);
                  setSelectedSpecificationId(id);
                }}
                onTaskChange={(ids) => {
                  setClearMode(false);
                  setSelectedTaskIds(ids);
                }}
                onLocationChange={(id) => {
                  setClearMode(false);
                  setSelectedLocationId(id);
                }}
                onAvailabilityChange={(id) => {
                  setClearMode(false);
                  setSelectedAvailabilityId(id);
                }}
                onClearSelection={clearSelection}
                onClearModeChange={setAssignmentClearMode}
              />
            </div>
          </div>
        ) : null}

        {/*
          Ieder de helft. Dit stond op twee staat tot een, omdat de week op de drempel van
          1600 anders te smal wordt om in te plannen. Op een breed scherm pakte de week
          daardoor ruimte die hij niet kan gebruiken: het rooster is nooit breder dan zeven
          dagen, dus die winst werd lege ruimte terwijl het paneel tegen de rand werd gedrukt.
          Nu deelt de rij eerlijk en houdt WEEK_MINIMUM_PX de bodem eronder, zodat de week op
          een smal scherm nog steeds voorgaat.
        */}
        {toontWeek ? (
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
            style={paneel === null ? undefined : { minWidth: WEEK_MINIMUM_PX }}
          >
            {slotError ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{slotError}</p> : null}
            {loadingSlots ? <p className="text-sm text-muted-foreground">Planning laden…</p> : null}
            <PlannerDaypartGrid
              participants={visibleParticipants}
              dayparts={visibleDayparts}
              weekStart={weekStart}
              zoom={zoom}
              renderCell={({ participant, datum, daypart }) =>
                renderSlot({
                  participant,
                  datum,
                  daypart,
                  hoverEnabled: cursorTool == null,
                })
              }
              onCellClick={canEdit ? queueCell : undefined}
              isCellDisabled={isCellDisabled}
              isCellUnavailable={isCellUnavailable}
              isCellFilled={isCellFilled}
              getCellClassName={getCellClassName}
              holidayLabels={holidays}
              cursorTool={cursorTool}
              onCursorToolDismiss={dismissCursorTool}
              renderParticipantActions={canEdit ? renderParticipantActions : undefined}
              onParticipantNameClick={readOnly ? undefined : openDeelnemerGegevens}
              verborgenWeekdagen={verborgenWeekdagen}
            />
          </div>
        ) : null}

        {paneel !== null ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            {/*
              Alleen om te kijken, of het nu naast de week staat of ervoor in de plaats. Die
              regel staat er alleen als de week er niet naast staat: staat hij er wel, dan
              wijst de planner gewoon links aan en zegt de regel niets nieuws.
            */}
            {canEdit && paneel === 'maand' && !naastElkaar ? (
              <p className="rounded-md border bg-muted/40 p-2 text-sm text-muted-foreground">
                De maand is om te kijken. Zet de weergave op Week om een dagdeel te plannen.
              </p>
            ) : null}
            {paneel === 'maand' ? (
              <PlannerMonthOverviewGrid
                verborgenWeekdagen={verborgenWeekdagen}
                participants={visibleParticipants}
                dayparts={visibleDayparts}
                year={monthAnchor.year}
                month={monthAnchor.month}
                renderCell={({ participant, datum, daypart }) =>
                  renderSlot({
                    participant,
                    datum,
                    daypart,
                    hoverEnabled: cursorTool == null,
                    variant: 'month',
                  })
                }
                holidayLabels={holidays}
                onParticipantNameClick={readOnly ? undefined : openDeelnemerGegevens}
              />
            ) : null}
            {paneel === 'capaciteit' ? (
              <CapacityOverviewPanel groupId={groupId} data={data} weekStart={weekStart} />
            ) : null}
            {paneel === 'locatie' ? (
              <LocatieSpecialismenPanel
                data={data}
                weekStart={weekStart}
                slots={slots}
                isAfwezig={isAfwezig}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {canEdit && actionModal?.type === 'copy' ? (
        <PlannerCopyWeekModal
          open
          onClose={() => setActionModal(null)}
          groupId={groupId}
          participant={actionModal.participant}
          sourceWeekStart={actionModal.sourceWeekStart}
          dayparts={visibleDayparts}
          schedulableDayparts={data.masterData.schedulableDayparts ?? []}
          participantSchedulableDayparts={data.masterData.participantSchedulableDayparts ?? []}
          onCopied={refreshAfterRecurrence}
        />
      ) : null}
      {canEdit && actionModal?.type === 'repeat' ? (
        <PlannerRepeatWeekModal
          open
          onClose={() => setActionModal(null)}
          groupId={groupId}
          participantId={actionModal.participant.id}
          participantName={participantDisplayName(actionModal.participant)}
          sourceWeekStart={actionModal.sourceWeekStart}
          onCreated={refreshAfterRecurrence}
        />
      ) : null}
      {canEdit && actionModal?.type === 'email' ? (
        <PlannerNotifyPlanningModal
          open
          onClose={() => setActionModal(null)}
          groupId={groupId}
          participantId={actionModal.participant.id}
          participantName={participantDisplayName(actionModal.participant)}
        />
      ) : null}
      {canEdit && actionModal?.type === 'manageHerhaling' ? (
        <PlannerManageHerhalingModal
          open
          onClose={() => setActionModal(null)}
          groupId={groupId}
          participantId={actionModal.participant.id}
          participantName={participantDisplayName(actionModal.participant)}
          defaultVanafWeekStart={weekStart}
          onChanged={refreshAfterRecurrence}
        />
      ) : null}

    </div>
  );
}

export default function ActiviteitenPlannerPage() {
  return (
    <>
      <Head>
        <title>Activiteiten planner | Praktijkplanner</title>
      </Head>
      <PraktijkplannerPage title="Activiteiten planner">
        {(context) => <ActivitiesContent {...context} />}
      </PraktijkplannerPage>
    </>
  );
}
