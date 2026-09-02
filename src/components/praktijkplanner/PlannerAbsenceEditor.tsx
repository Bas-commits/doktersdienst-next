'use client';

import { PlannerWeekendToggle } from './PlannerWeekendToggle';
import {
  metVerborgenWeekend,
  useWeekendVoorkeur,
} from '@/hooks/praktijkplanner/useWeekendVerbergen';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Mail, Minus, Moon, Plus, RotateCcw, Sun, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { PraktijkplannerTitleAside, type PraktijkplannerPageContext } from './PraktijkplannerPage';
import { AbsenceDaypartCell } from './AbsenceDaypartCell';
import { PlannerDaypartHoverPreview } from './PlannerDaypartHoverPreview';
import { PlannerDienstvoorkeurConflictModal } from './PlannerDienstvoorkeurConflictModal';
import {
  DIENSTVOORKEUR_WEERGAVE,
  dienstvoorkeurKleur,
  dienstvoorkeurLabel,
  PlannerDienstvoorkeurMark,
} from './PlannerDienstvoorkeurMark';
import { absenceDisplayBackground, absenceDisplayColor, absenceForegroundIconPath, absencePaletteIconPath, DAYPART_ICONS, sortAbsenceTypesForPalette } from './absence-icons';
import { PlannerChipPalette } from './PlannerChipPalette';
import type { PlannerCursorTool } from './PlannerCursorTool';
import { PlannerDaypartGrid } from './PlannerDaypartGrid';
import { PlannerMonthDaypartGrid } from './PlannerMonthDaypartGrid';
import { PlannerMonthOverviewGrid } from './PlannerMonthOverviewGrid';
import { PlannerAvondNachtToggle } from './PlannerAvondNachtToggle';
import { PlannerNevenschermKeuze } from './PlannerNevenschermKeuze';
import { PlannerWeekBar } from './PlannerWeekBar';
import { MonthNavigation } from '@/components/CalandarGrid/MonthNavigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { usePlannerHolidayData } from '@/hooks/praktijkplanner/usePlannerHolidays';
import { usePlannerWeergave } from '@/hooks/praktijkplanner/usePlannerWeergave';
import { deelnemerChipInitials } from '@/lib/deelnemer-display';
import { groepPlantDiensten } from '@/lib/praktijkplanner/diensten-in-groep';
import {
  zichtbareDagdelen,
} from '@/lib/praktijkplanner/dagdeel-zichtbaarheid';
import {
  addDays,
  datesBetweenInclusive,
  isDatumVoorbij,
  weekdayFromIsoDate,
  maandVanWeek,
  monthBounds,
  monthCalendarBounds,
  weekVanMaand,
} from '@/lib/praktijkplanner/dates';
import { deelnemerRoosterNaam } from '@/lib/deelnemer-display';
import { downloadPlannerAfwezigheden } from '@/lib/praktijkplanner/rooster-export';
import { notifyPlannerChanged } from '@/lib/praktijkplanner/planner-change-broadcast';
import {
  dagdelenZonderRooster,
  isDaypartSchedulableForParticipant,
  participantMatrixFor,
  weekdagenZonderRooster,
} from '@/lib/praktijkplanner/schedulable-dayparts';
import type {
  PraktijkplannerAbsenceSlot,
  PraktijkplannerDaypart,
  PraktijkplannerDienstvoorkeur,
  PraktijkplannerDienstvoorkeurWaarde,
} from '@/types/praktijkplanner';
 


const TOAST_POSITION = 'bottom-right' as const;

function keyFor(iddeelnemer: number, datum: string, iddagdeel: number) {
  return `${iddeelnemer}:${datum}:${iddagdeel}`;
}

function participantName(participant: PraktijkplannerPageContext['data']['participants'][number]) {
  return (
    [participant.voornaam, participant.achternaam].filter(Boolean).join(' ') ||
    participant.name ||
    participant.initialen ||
    `Deelnemer ${participant.id}`
  );
}

const REMOVE_PALETTE_ID = '__remove_absence__';
const REMOVE_PALETTE_ICON = <Trash2 aria-hidden />;
/** Wat het palet aanzet: welke voorkeur, en of het een aanvraag is of iets wat vastligt. */
type DienstKeuze = {
  waarde: PraktijkplannerDienstvoorkeurWaarde;
  aangevraagd: boolean;
};

const DIENST_WAARDEN = Object.keys(
  DIENSTVOORKEUR_WEERGAVE
) as PraktijkplannerDienstvoorkeurWaarde[];

function dienstPaletteId(keuze: DienstKeuze): string {
  return `__dienst_${keuze.waarde}${keuze.aangevraagd ? '_aangevraagd' : ''}__`;
}

function dienstvoorkeurVanPaletteId(id: number | string): DienstKeuze | null {
  for (const waarde of DIENST_WAARDEN) {
    for (const aangevraagd of [true, false]) {
      const keuze = { waarde, aangevraagd };
      if (dienstPaletteId(keuze) === id) return keuze;
    }
  }
  return null;
}

function provisionalPaletteId(typeId: number) {
  return `${typeId}__provisional`;
}

function confirmedPaletteId(typeId: number) {
  return `${typeId}__confirmed`;
}

function parsePaletteSelection(id: number | string) {
  if (typeof id === 'number') {
    return { typeId: id, provisional: true };
  }
  if (id.endsWith('__provisional')) {
    return { typeId: Number(id.slice(0, -'__provisional'.length)), provisional: true };
  }
  if (id.endsWith('__confirmed')) {
    return { typeId: Number(id.slice(0, -'__confirmed'.length)), provisional: false };
  }
  return { typeId: null, provisional: false };
}

export type PlannerAbsenceEditorMode = 'manager' | 'doctor';

export function PlannerAbsenceEditor({
  context,
  mode,
}: {
  context: PraktijkplannerPageContext;
  mode: PlannerAbsenceEditorMode;
}) {
  const { groupId, data } = context;
  const isDoctorMode = mode === 'doctor';
  const { weekStart, setWeekStart, nevenscherm, setNevenscherm } = usePlannerWeergave(groupId);
  // Dit scherm kent alleen de week en de maand. Staat de planner elders op capaciteit of
  // locatie, dan is er hier niets om naast te zetten en blijft de week staan.
  const toontMaand = nevenscherm === 'maand';
  const [slots, setSlots] = useState<PraktijkplannerAbsenceSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [isVoorlopig, setIsVoorlopig] = useState(isDoctorMode);
  const [clearMode, setClearMode] = useState(false);
  const [dienstKeuze, setDienstKeuze] = useState<DienstKeuze | null>(null);
  const [voorkeuren, setVoorkeuren] = useState<PraktijkplannerDienstvoorkeur[]>([]);
  const [conflict, setConflict] = useState<{
    melding: string;
    beslis: (akkoord: boolean) => void;
  } | null>(null);
  const [emailParticipantId, setEmailParticipantId] = useState<number | null>(null);
  const [showNight, setShowNight] = useState(false);
  const [zoom, setZoom] = useState(100);

  // Ook de maandkalender van de dokterversie hangt aan weekStart. Die had een eigen maand en
  // jaar, en dan is er niets wat die twee bij elkaar houdt zodra de schermen elkaar volgen.
  const overviewMonth = useMemo(() => maandVanWeek(weekStart), [weekStart]);

  const range = useMemo(() => {
    if (!isDoctorMode) {
      if (toontMaand) {
        const bounds = monthBounds(overviewMonth.year, overviewMonth.month);
        if (bounds) return bounds;
      }
      return { start: weekStart, end: addDays(weekStart, 6) };
    }
    const { year, month } = overviewMonth;
    return (
      monthCalendarBounds(year, month) ?? {
        start: `${year}-${String(month).padStart(2, '0')}-01`,
        end: `${year}-${String(month).padStart(2, '0')}-28`,
      }
    );
  }, [isDoctorMode, overviewMonth, toontMaand, weekStart]);
  const holidayData = usePlannerHolidayData(range.start, range.end);
  const participants = isDoctorMode
    ? data.participants.filter((participant) => participant.id === data.userId)
    : data.participants;
  const editable = isDoctorMode || data.isManager;
  const { weekendVerborgen, setWeekendVerborgen } = useWeekendVoorkeur(groupId);
  const verborgenWeekdagen = useMemo(
    () =>
      metVerborgenWeekend(
        weekdagenZonderRooster(data.masterData.schedulableDayparts ?? []),
        weekendVerborgen
      ),
    [data.masterData.schedulableDayparts, weekendVerborgen]
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

  // Dezelfde afleiding waar de naam van dit scherm op steunt, zie diensten-in-groep.
  const heeftDienstTaken = useMemo(
    () => groepPlantDiensten(data.masterData.tasks),
    [data.masterData.tasks]
  );

  useEffect(() => {
    if (emailParticipantId != null || data.participants.length === 0) return;
    setEmailParticipantId(data.participants[0].id);
  }, [data.participants, emailParticipantId]);

  // Nu ook in beheerdersmodus. De voorkeur werd hier alleen voor de dokter opgehaald, want
  // alleen diens maandkalender deed er iets mee; het weekrooster toonde altijd alle vier.
  useEffect(() => {
    const abortController = new AbortController();
    fetch(`/api/praktijkplanner/voorkeuren?idwaarneemgroep=${groupId}`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { toonNacht?: boolean };
        if (!response.ok || abortController.signal.aborted) return;
        if (typeof payload.toonNacht === 'boolean') setShowNight(payload.toonNacht);
      })
      .catch(() => undefined);

    return () => abortController.abort();
  }, [groupId]);

  // toonDag gaat altijd als true mee: ochtend en middag zijn niet meer uit te zetten. De
  // oude regel "kies minimaal Dag of Nacht" is daarmee ook weg, want er valt niets meer te
  // kiezen wat het rooster leeg kan maken.
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
      }).catch(() => toast.error('De weergavevoorkeur kon niet worden opgeslagen.'));
    },
    [groupId]
  );

  const loadSlots = useCallback(() => {
    if (isDoctorMode && participants.length === 0) {
      setLoading(false);
      setSlots([]);
      return () => undefined;
    }

    const abortController = new AbortController();
    setLoading(true);
    const participant = isDoctorMode ? `&iddeelnemer=${data.userId}` : '';
    fetch(
      `/api/praktijkplanner/afwezigheden?idwaarneemgroep=${groupId}&start=${range.start}&end=${range.end}${participant}`,
      { credentials: 'include', signal: abortController.signal }
    )
      .then(async (response) => {
        const payload = (await response.json()) as { slots?: PraktijkplannerAbsenceSlot[]; error?: string };
        if (!response.ok || !payload.slots) throw new Error(payload.error || 'Afwezigheden konden niet worden geladen.');
        return payload.slots;
      })
      .then((loaded) => {
        if (!abortController.signal.aborted) setSlots(loaded);
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          toast.error(error instanceof Error ? error.message : 'Afwezigheden konden niet worden geladen.');
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false);
      });
    return () => abortController.abort();
  }, [data.userId, groupId, isDoctorMode, participants.length, range.end, range.start]);

  useEffect(() => loadSlots(), [loadSlots]);

  const voorkeurenUrl = useMemo(
    () =>
      `/api/praktijkplanner/dienstvoorkeuren?idwaarneemgroep=${groupId}&start=${range.start}&end=${range.end}` +
      (isDoctorMode ? `&iddeelnemer=${data.userId}` : ''),
    [data.userId, groupId, isDoctorMode, range.end, range.start]
  );

  const refreshVoorkeuren = useCallback(
    async (signal?: AbortSignal) => {
      if (!heeftDienstTaken) return;
      const response = await fetch(voorkeurenUrl, { credentials: 'include', signal });
      const payload = (await response.json()) as {
        voorkeuren?: PraktijkplannerDienstvoorkeur[];
        error?: string;
      };
      if (!response.ok || !payload.voorkeuren) {
        throw new Error(payload.error || 'De dienstvoorkeuren konden niet worden geladen.');
      }
      if (!signal?.aborted) setVoorkeuren(payload.voorkeuren);
    },
    [heeftDienstTaken, voorkeurenUrl]
  );

  useEffect(() => {
    if (!heeftDienstTaken) {
      setVoorkeuren([]);
      return;
    }
    const abortController = new AbortController();
    refreshVoorkeuren(abortController.signal).catch((error: unknown) => {
      if (abortController.signal.aborted) return;
      toast.error(
        error instanceof Error ? error.message : 'De dienstvoorkeuren konden niet worden geladen.'
      );
    });
    return () => abortController.abort();
  }, [heeftDienstTaken, refreshVoorkeuren]);

  const slotMap = useMemo(
    () => new Map(slots.map((slot) => [keyFor(slot.iddeelnemer, slot.datum, slot.iddagdeel), slot])),
    [slots]
  );

  const voorkeurMap = useMemo(
    () =>
      new Map(
        voorkeuren.map((voorkeur) => [
          keyFor(voorkeur.iddeelnemer, voorkeur.datum, voorkeur.iddagdeel),
          voorkeur,
        ])
      ),
    [voorkeuren]
  );

  /*
    De dagen die op het scherm staan: de week, of de maand als die gekozen is, min de weekdagen
    waar de groep nooit op werkt. Dezelfde periode als waarmee de afwezigheden zijn opgehaald,
    dus wat je downloadt is wat je ziet.
  */
  const exportDatums = useMemo(
    () =>
      datesBetweenInclusive(range.start, range.end).filter(
        (datum) => !verborgenWeekdagen.has(weekdayFromIsoDate(datum))
      ),
    [range.start, range.end, verborgenWeekdagen]
  );
  const [downloading, setDownloading] = useState(false);

  /** Zet de getoonde afwezigheden in een Excel-bestand. */
  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadPlannerAfwezigheden({
        bestandsnaam: `praktijkplanner-afwezigheid-${range.start}.xlsx`,
        kop: `Afwezigheid ${range.start} tot ${range.end}`,
        datums: exportDatums,
        dagdelen: visibleDayparts.map((daypart) => ({ id: daypart.id, naam: daypart.naam })),
        deelnemers: participants.map((participant) => ({
          id: participant.id,
          naam: deelnemerRoosterNaam(participant),
        })),
        absences: slots,
      });
    } finally {
      setDownloading(false);
    }
  }

  /*
    Staat op beide varianten van dit scherm. De planner haalt er de week of de maand van de hele
    groep uit, de dokter zijn eigen maand; in allebei de gevallen precies wat er op het scherm
    staat, dus er komt geen recht bij kijken.
  */
  const downloadKnop = (
    <button
      type="button"
      onClick={() => void handleDownload()}
      disabled={loading || downloading || participants.length === 0}
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      title="Download de getoonde periode als Excel-bestand"
    >
      <Download className="size-4" aria-hidden />
      Download Excel
    </button>
  );

  const resolveAbsence = useCallback(
    (iddeelnemer: number, datum: string, iddagdeel: number) => {
      const current = slotMap.get(keyFor(iddeelnemer, datum, iddagdeel));
      return {
        absence: current?.absenceType ?? null,
        provisional: current?.isVoorlopig,
      };
    },
    [slotMap]
  );

  const renderCell = useCallback(
    (
      participant: PraktijkplannerPageContext['data']['participants'][number],
      datum: string,
      daypart: PraktijkplannerDaypart
    ) => {
      const { absence, provisional } = resolveAbsence(participant.id, datum, daypart.id);
      const voorkeur = voorkeurMap.get(keyFor(participant.id, datum, daypart.id)) ?? null;
      if (!absence && !voorkeur) {
        if (isDoctorMode) {
          const icon = DAYPART_ICONS[daypart.volgorde];
          return icon ? (
            <Image src={icon} alt="" width={24} height={24} className="mx-auto size-6 opacity-60" />
          ) : (
            <span className="text-xs">{daypart.naam.slice(0, 1)}</span>
          );
        }
        return null;
      }

      /*
        Allebei tegelijk kan: een dagdeel met vakantie waarop de dokter toch graag dienst doet.
        De afwezigheid houdt dan het vlak en de voorkeur wordt een hoekje, zodat de botsing te
        zien blijft in plaats van dat er een van de twee onder de andere verdwijnt.
      */
      const cell = absence ? (
        <div className="relative h-full w-full">
          <AbsenceDaypartCell
            absence={absence}
            provisional={provisional}
            participantColor={participant.color}
            /*
              Op het eigen scherm van de dokter staat er maar een deelnemer in het rooster, dus
              zeggen zijn eigen initialen op elke tegel niets. Bij de planner staan de rijen van
              alle deelnemers door elkaar en is het bolletje juist waar je op afgaat.
            */
            participantInitials={isDoctorMode ? null : deelnemerChipInitials(participant)}
            density={!isDoctorMode && toontMaand ? 'micro' : 'compact'}
            fill
          />
          {voorkeur ? (
            <PlannerDienstvoorkeurMark
              voorkeur={voorkeur.voorkeur}
              aangevraagd={voorkeur.isVoorlopig}
              variant="hoek"
            />
          ) : null}
        </div>
      ) : voorkeur ? (
        <PlannerDienstvoorkeurMark voorkeur={voorkeur.voorkeur} aangevraagd={voorkeur.isVoorlopig} />
      ) : null;

      // Zonder deze kaart vertelt het vakje alleen zijn kleur. De dokterversie toont maar één
      // deelnemer, dus daar zou de naam iedere keer dezelfde regel zijn.
      return (
        <PlannerDaypartHoverPreview
          enabled={!(editable && (clearMode || selectedTypeId != null || dienstKeuze != null))}
          participantName={participantName(participant)}
          initials={deelnemerChipInitials(participant)}
          datum={datum}
          daypartName={daypart.naam}
          fromRepetition={false}
          isException={false}
          absence={absence ? { type: absence.naam, aangevraagd: provisional === true } : null}
          dienstvoorkeur={voorkeur ? { waarde: voorkeur.voorkeur, aangevraagd: voorkeur.isVoorlopig } : null}
          showPlanningDetails={false}
          showParticipant={!isDoctorMode}
          chip={<div className="relative h-full w-full">{cell}</div>}
        >
          {cell}
        </PlannerDaypartHoverPreview>
      );
    },
    [
      clearMode,
      dienstKeuze,
      editable,
      isDoctorMode,
      resolveAbsence,
      selectedTypeId,
      toontMaand,
      voorkeurMap,
    ]
  );

  const isCellFilled = useCallback(
    (iddeelnemer: number, datum: string, daypart: PraktijkplannerDaypart) =>
      resolveAbsence(iddeelnemer, datum, daypart.id).absence != null ||
      voorkeurMap.has(keyFor(iddeelnemer, datum, daypart.id)),
    [resolveAbsence, voorkeurMap]
  );

  const refreshSlots = useCallback(async () => {
    const participant = isDoctorMode ? `&iddeelnemer=${data.userId}` : '';
    const response = await fetch(
      `/api/praktijkplanner/afwezigheden?idwaarneemgroep=${groupId}&start=${range.start}&end=${range.end}${participant}`,
      { credentials: 'include' }
    );
    const payload = (await response.json()) as { slots?: PraktijkplannerAbsenceSlot[]; error?: string };
    if (!response.ok || !payload.slots) {
      throw new Error(payload.error || 'Afwezigheden konden niet worden geladen.');
    }
    setSlots(payload.slots);
  }, [data.userId, groupId, isDoctorMode, range.end, range.start]);

  const bewaarVoorkeur = useCallback(
    async (
      iddeelnemer: number,
      datum: string,
      iddagdeel: number,
      keuze: DienstKeuze | null
    ) => {
      try {
        const response = await fetch('/api/praktijkplanner/dienstvoorkeuren', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idwaarneemgroep: groupId,
            voorkeuren: [
              {
                iddeelnemer,
                datum,
                iddagdeel,
                voorkeur: keuze?.waarde ?? null,
                isVoorlopig: keuze?.aangevraagd ?? true,
              },
            ],
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || 'De dienstvoorkeur kon niet worden opgeslagen.');
        }
        await refreshVoorkeuren();
        toast.success(
          keuze == null
            ? 'Dienstvoorkeur verwijderd.'
            : `${dienstvoorkeurLabel(keuze.waarde, keuze.aangevraagd)} opgeslagen.`,
          { position: TOAST_POSITION }
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'De dienstvoorkeur kon niet worden opgeslagen.',
          { position: TOAST_POSITION }
        );
      }
    },
    [groupId, refreshVoorkeuren]
  );

  /** Toont het waarschuwingsvenster en wacht tot de dokter kiest. */
  const vraagBevestiging = useCallback(
    (melding: string) =>
      new Promise<boolean>((resolve) => {
        setConflict({
          melding,
          beslis: (akkoord: boolean) => {
            setConflict(null);
            resolve(akkoord);
          },
        });
      }),
    []
  );

  const applyCell = useCallback(
    async ({
      participant,
      datum,
      daypart,
    }: {
      participant: { id: number };
      datum: string;
      daypart: { id: number };
    }) => {
      if (!editable) return;
      /*
        Het eigen scherm van de dokter is voor dagen die voorbij zijn alleen om in te zien. De
        vakjes zijn daar al niet meer aanklikbaar; dit vangt de slepende variant af, die met
        ctrl ingedrukt over de vakjes gaat en dus niet elk vakje zelf aanklikt.
      */
      if (isDoctorMode && isDatumVoorbij(datum)) return;
      const participantId = isDoctorMode ? data.userId : participant.id;
      const key = keyFor(participantId, datum, daypart.id);
      const existing = slotMap.get(key);
      const staandeVoorkeur = voorkeurMap.get(key) ?? null;

      /*
        Een dienstvoorkeur gaat over diensten, niet over het gewone rooster, en mag dus ook op
        een dagdeel waarop deze dokter niet ingeroosterd wordt. Dat is dezelfde regel als die
        een dienst zelf daar wel laat staan, en daarom staat dit voor de controle hieronder.
      */
      if (dienstKeuze != null) {
        if (dienstKeuze.waarde === 'graag' && existing) {
          const akkoord = await vraagBevestiging(
            `Op dit dagdeel staat ${existing.absenceType.naam}. Toch aangeven dat u hier graag dienst doet? Allebei blijft staan.`
          );
          if (!akkoord) return;
        }
        await bewaarVoorkeur(participantId, datum, daypart.id, dienstKeuze);
        return;
      }

      // Leegmaken haalt ook de dienstvoorkeur weg. Staat er verder niets, dan is het klaar.
      if (clearMode && staandeVoorkeur) {
        await bewaarVoorkeur(participantId, datum, daypart.id, null);
        if (!existing) return;
      }

      if (!clearMode && selectedTypeId != null && staandeVoorkeur?.voorkeur === 'graag') {
        const akkoord = await vraagBevestiging(
          'Op dit dagdeel staat Dienst graag. Toch afwezigheid aangeven? Allebei blijft staan.'
        );
        if (!akkoord) return;
      }

      const inroosterbaar = isDaypartSchedulableForParticipant(
        data.masterData.schedulableDayparts ?? [],
        participantMatrixFor(data.masterData.participantSchedulableDayparts ?? [], participantId),
        datum,
        daypart.id
      );
      /*
        Op een dagdeel waarop deze dokter niet ingeroosterd kan worden mag er niets bij, maar wat
        er staat mag er wel af. Zulke afwezigheden bestaan: ze tellen mee in de jaarbalans terwijl
        het scherm ze tot voor kort niet tekende, en dan is er geen enkele manier om een saldo dat
        niet klopt recht te zetten.
      */
      if (!inroosterbaar) {
        if (!existing) return;
        if (!clearMode) {
          toast.info('Dit dagdeel is niet inplanbaar. Kies Leegmaken om het weg te halen.', {
            position: TOAST_POSITION,
          });
          return;
        }
      }
      if (!clearMode && selectedTypeId == null) {
        toast.info('Kies eerst een afwezigheidstype.', { position: TOAST_POSITION });
        return;
      }

      if (isDoctorMode && existing && !existing.isVoorlopig) {
        toast.info('Deze afwezigheid is bevestigd en kan niet meer worden gewijzigd.', {
          position: TOAST_POSITION,
        });
        return;
      }
      const idafwezigheidstype = clearMode ? null : selectedTypeId;
      const isVoorlopigValue = clearMode ? false : isDoctorMode || isVoorlopig;
      const absenceType =
        idafwezigheidstype != null
          ? data.masterData.absenceTypes.find((type) => type.id === idafwezigheidstype)
          : null;

      if (idafwezigheidstype != null && !absenceType) {
        toast.error('Het gekozen afwezigheidstype is niet beschikbaar.', { position: TOAST_POSITION });
        return;
      }

      const previousSlots = slots;
      setSlots((current) => {
        const next = current.filter(
          (slot) => keyFor(slot.iddeelnemer, slot.datum, slot.iddagdeel) !== key
        );
        if (absenceType) {
          next.push({
            id: existing?.id ?? -1,
            iddeelnemer: participantId,
            datum,
            iddagdeel: daypart.id,
            idafwezigheidstype: absenceType.id,
            isVoorlopig: isVoorlopigValue,
            version: existing?.version ?? 0,
            absenceType: {
              id: absenceType.id,
              naam: absenceType.naam,
              code: absenceType.code,
              kleur: absenceType.kleur,
              icon: absenceType.icon,
            },
          });
        }
        return next;
      });

      try {
        const response = await fetch('/api/praktijkplanner/afwezigheden', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idwaarneemgroep: groupId,
            slots: [
              {
                iddeelnemer: participantId,
                datum,
                iddagdeel: daypart.id,
                idafwezigheidstype,
                isVoorlopig: isVoorlopigValue,
                version: existing?.version ?? null,
              },
            ],
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Wijziging kon niet worden opgeslagen.');
        await refreshSlots();
        notifyPlannerChanged(groupId);
        toast.success(clearMode ? 'Afwezigheid verwijderd.' : 'Afwezigheid opgeslagen.', {
          position: TOAST_POSITION,
        });
      } catch (error) {
        setSlots(previousSlots);
        toast.error(error instanceof Error ? error.message : 'Wijziging kon niet worden opgeslagen.', {
          position: TOAST_POSITION,
        });
      }
    },
    [
      bewaarVoorkeur,
      clearMode,
      data.masterData.absenceTypes,
      data.masterData.participantSchedulableDayparts,
      data.masterData.schedulableDayparts,
      data.userId,
      editable,
      groupId,
      isDoctorMode,
      isVoorlopig,
      refreshSlots,
      dienstKeuze,
      selectedTypeId,
      slotMap,
      slots,
      voorkeurMap,
      vraagBevestiging,
    ]
  );

  const email = useCallback(async () => {
    if (!emailParticipantId || !data.isManager) return;
    try {
      const response = await fetch('/api/praktijkplanner/email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          iddeelnemer: emailParticipantId,
          plannerType: 'afwezigheden',
          start: range.start,
          end: range.end,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'E-mail versturen mislukt.');
      toast.success('Afwezigheden per e-mail verstuurd.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'E-mail versturen mislukt.');
    }
  }, [data.isManager, emailParticipantId, groupId, range.end, range.start]);

  // De maandkeuze wordt een week, want dat is wat de schermen delen. weekVanMaand pakt de week
  // van de 4e, zodat de donderdag gegarandeerd in de gekozen maand valt.
  const changeMonth = useCallback((nextYear: number, nextMonth: number) => {
    setWeekStart(weekVanMaand(nextYear, nextMonth));
  }, [setWeekStart]);

  const paletteItems = useMemo(() => {
    const orderedTypes = sortAbsenceTypesForPalette(data.masterData.absenceTypes);
    const absenceItems =
      isDoctorMode
        ? orderedTypes.map((type) => ({
            id: type.id,
            label: `${type.naam}?`,
            color: absenceDisplayColor(type.code, type.kleur, true),
            background: absenceDisplayBackground(type.code, type.kleur, true),
            icon: absencePaletteIconPath(type.code, type.icon, true),
          }))
        : orderedTypes.flatMap((type) => [
            {
              id: provisionalPaletteId(type.id),
              label: `${type.naam}?`,
              color: absenceDisplayColor(type.code, type.kleur, true),
              background: absenceDisplayBackground(type.code, type.kleur, true),
              icon: absencePaletteIconPath(type.code, type.icon, true),
            },
            {
              id: confirmedPaletteId(type.id),
              label: type.naam,
              color: absenceDisplayColor(type.code, type.kleur, false),
              background: absenceDisplayBackground(type.code, type.kleur, false),
              icon: absencePaletteIconPath(type.code, type.icon, false),
            },
          ]);
    // Het vraagteken volgt dezelfde regel als bij de afwezigheidstypen: de dokter vraagt, de
    // planner legt vast. Anders dan daar is het hier alleen taal en geen toestand, want een
    // dienstvoorkeur wordt niet goedgekeurd; er is dus ook geen tweede blokje voor de planner.
    const dienstBlokje = (keuze: DienstKeuze) => {
      const { Icon } = DIENSTVOORKEUR_WEERGAVE[keuze.waarde];
      const kleur = dienstvoorkeurKleur(keuze.waarde, keuze.aangevraagd);
      return {
        id: dienstPaletteId(keuze),
        label: dienstvoorkeurLabel(keuze.waarde, keuze.aangevraagd),
        color: kleur,
        background: kleur,
        icon: <Icon aria-hidden />,
      };
    };
    const dienstItems = heeftDienstTaken
      ? DIENST_WAARDEN.flatMap((waarde) =>
          isDoctorMode
            ? [dienstBlokje({ waarde, aangevraagd: true })]
            : [
                dienstBlokje({ waarde, aangevraagd: true }),
                dienstBlokje({ waarde, aangevraagd: false }),
              ]
        )
      : [];
    return [
      { id: REMOVE_PALETTE_ID, label: 'Leegmaken', color: '#c91b23', background: '#c91b23', icon: REMOVE_PALETTE_ICON },
      ...absenceItems,
      ...dienstItems,
    ];
  }, [data.masterData.absenceTypes, heeftDienstTaken, isDoctorMode]);

  const selectedPaletteId = dienstKeuze
    ? dienstPaletteId(dienstKeuze)
    : clearMode || selectedTypeId == null
        ? clearMode
          ? REMOVE_PALETTE_ID
          : null
        : !isDoctorMode
          ? isVoorlopig
            ? provisionalPaletteId(selectedTypeId)
            : confirmedPaletteId(selectedTypeId)
          : selectedTypeId;

  const dismissCursorTool = useCallback(() => {
    setSelectedTypeId(null);
    setClearMode(false);
    setDienstKeuze(null);
  }, []);

  const cursorTool = useMemo((): PlannerCursorTool | null => {
    if (!editable) return null;
    if (clearMode) {
      return {
        icon: <Trash2 className="text-white" aria-hidden />,
        color: '#c91b23',
        label: 'Leegmaken',
      };
    }
    if (dienstKeuze) {
      const { Icon } = DIENSTVOORKEUR_WEERGAVE[dienstKeuze.waarde];
      const kleur = dienstvoorkeurKleur(dienstKeuze.waarde, dienstKeuze.aangevraagd);
      return {
        icon: <Icon className="text-white" aria-hidden />,
        color: kleur,
        background: kleur,
        label: DIENSTVOORKEUR_WEERGAVE[dienstKeuze.waarde].label,
      };
    }
    if (selectedTypeId == null) return null;
    const absenceType = data.masterData.absenceTypes.find((type) => type.id === selectedTypeId);
    if (!absenceType) return null;
    const provisional = isDoctorMode || isVoorlopig;
    return {
      icon: absenceForegroundIconPath(absenceType.code, absenceType.icon, provisional),
      color: absenceDisplayColor(absenceType.code, absenceType.kleur, provisional),
      background: absenceDisplayBackground(absenceType.code, absenceType.kleur, provisional),
      label: absenceType.naam,
    };
  }, [
    clearMode,
    data.masterData.absenceTypes,
    dienstKeuze,
    editable,
    isDoctorMode,
    isVoorlopig,
    selectedTypeId,
  ]);

  // Week en maand hangen dezelfde knoppen op, en het moeten dezelfde knoppen in dezelfde
  // volgorde blijven.
  const weergaveKnoppen = (
    <>
      {editable ? (
        <PlannerAvondNachtToggle aan={showNight} onChange={updateVisibility} />
      ) : null}
      <PlannerWeekendToggle verborgen={weekendVerborgen} onChange={setWeekendVerborgen} />
      {/*
        Dit scherm zet nooit twee panelen naast elkaar, dus de maand komt hier altijd in de
        plaats van de week. Capaciteit en locatie horen bij de planner en staan hier niet.
      */}
      <PlannerNevenschermKeuze
        value={toontMaand ? 'maand' : 'geen'}
        onChange={setNevenscherm}
        keuzes={['geen', 'maand']}
        naastElkaar={false}
      />
    </>
  );

  return (
    <div className="space-y-4">
      <PlannerDienstvoorkeurConflictModal
        open={conflict != null}
        melding={conflict?.melding ?? ''}
        onBevestig={() => conflict?.beslis(true)}
        onAnnuleer={() => conflict?.beslis(false)}
      />
  

      <div className="flex items-start gap-4">
      {/*
        In de maandweergave van de beheerder is er niets aan te klikken, dus het palet zou
        alleen maar uitnodigen tot iets wat niet werkt. De dokterversie heeft zijn eigen
        maandkalender waarin je wel kunt kiezen, en houdt het palet dus.
      */}
      {editable && !(!isDoctorMode && toontMaand) ? (
        <div className="shrink-0 self-stretch">
          {/*
            Het palet begint bovenaan. Het sloeg eerder de hoogte van de navigatie over, want
            die stond boven het rooster; nu staat die in de paginakop en valt er niets meer
            over te slaan.
          */}
          <aside className="sticky top-0" data-planner-tool-keep-active>
            <PlannerChipPalette
            variant="sidebar"
            title={
              isDoctorMode
                ? heeftDienstTaken
                  ? 'Afwezigheid en dienst aangeven'
                  : 'Afwezigheid aangeven'
                : 'Afwezigheidstypen'
            }
            items={paletteItems}
            selectedId={selectedPaletteId}
            onSelect={(id) => {
              if (id === REMOVE_PALETTE_ID) {
                setClearMode(true);
                setSelectedTypeId(null);
                setDienstKeuze(null);
                return;
              }
              const dienst = dienstvoorkeurVanPaletteId(id);
              if (dienst) {
                setDienstKeuze(dienst);
                setClearMode(false);
                setSelectedTypeId(null);
                return;
              }
              const { typeId, provisional } = parsePaletteSelection(id);
              setClearMode(false);
              setDienstKeuze(null);
              setSelectedTypeId(typeId);
              setIsVoorlopig(isDoctorMode || provisional);
            }}
            onClear={() => {
              setClearMode(false);
              setSelectedTypeId(null);
              setDienstKeuze(null);
            }}
          />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1 space-y-4">
      {loading ? <p className="text-sm text-muted-foreground">Afwezigheden laden…</p> : null}
      {!isDoctorMode ? (
        <div className="space-y-2">
          {/*
            De weekbalk staat in de paginakop, net als bij de Activiteiten planner. Binnen het
            rooster begint hij pas naast het palet, en dan is er met de zijbalk open te weinig
            breedte over: de balk brak dan in tweeen terwijl hij op de Activiteiten planner
            gewoon op een regel bleef staan.
          */}
          <PraktijkplannerTitleAside>
            <PlannerWeekBar weekStart={weekStart} onWeekStartChange={setWeekStart} />
            {weergaveKnoppen}
            {downloadKnop}
          </PraktijkplannerTitleAside>
          {editable && toontMaand ? (
            <p className="rounded-md border bg-muted/40 p-2 text-sm text-muted-foreground">
              De maand is om te kijken. Zet de weergave op Week om een afwezigheid te zetten.
            </p>
          ) : null}
          {toontMaand ? (
            <PlannerMonthOverviewGrid
              verborgenWeekdagen={verborgenWeekdagen}
              participants={participants}
              dayparts={visibleDayparts}
              year={overviewMonth.year}
              month={overviewMonth.month}
              renderCell={({ participant, datum, daypart }) =>
                renderCell(participant, datum, daypart)
              }
              isCellFilled={({ participant, datum, daypart }) =>
                isCellFilled(participant.id, datum, daypart)
              }
              holidayLabels={holidayData.labels}
            />
          ) : (
        <PlannerDaypartGrid
          participants={participants}
          dayparts={visibleDayparts}
          weekStart={weekStart}
          verborgenWeekdagen={verborgenWeekdagen}
          toonInhoudOpNietInplanbaar
          renderCell={({ participant, datum, daypart }) => renderCell(participant, datum, daypart)}
          isCellFilled={({ participant, datum, daypart }) => isCellFilled(participant.id, datum, daypart)}
          onCellClick={applyCell}
          /*
            Meerdere dagdelen in een beweging, met ctrl ingedrukt. Precies wat het scherm van de
            dokter zelf al deed; hier moest de planner elk vakje los aanklikken.

            Ctrl is de voorwaarde en niet de ingedrukte muisknop, want zo doet het andere scherm
            het ook. Zonder die eis zou de muis over het rooster bewegen al invoer doen.
          */
          onCellPointerEnter={(cell, event) => {
            if (event.ctrlKey) void applyCell(cell);
          }}
          isCellDisabled={() => !editable}
          isCellUnavailable={({ participant, datum, daypart }) =>
            !isDaypartSchedulableForParticipant(
              data.masterData.schedulableDayparts ?? [],
              participantMatrixFor(
                data.masterData.participantSchedulableDayparts ?? [],
                participant.id
              ),
              datum,
              daypart.id
            )
          }
          holidayLabels={holidayData.labels}
          cursorTool={cursorTool}
          onCursorToolDismiss={dismissCursorTool}
        />
          )}
        </div>
      ) : participants[0] ? (
        <div>
          {/*
            Ook deze navigatie staat in de paginakop. Naast het palet is er met de zijbalk
            open te weinig breedte, en dan breekt de maandenrij net zo in tweeen als de
            weekbalk deed.
          */}
          <PraktijkplannerTitleAside>
            <MonthNavigation
              month={overviewMonth.month - 1}
              year={overviewMonth.year}
              onSelectMonth={(selectedMonth, selectedYear) => changeMonth(selectedYear, selectedMonth + 1)}
            />
            {editable ? (
              <PlannerAvondNachtToggle
                aan={showNight}
                onChange={updateVisibility}
              />
            ) : null}
            <PlannerWeekendToggle verborgen={weekendVerborgen} onChange={setWeekendVerborgen} />
            {downloadKnop}
          </PraktijkplannerTitleAside>
          <div className="overflow-x-auto pb-2">
          <div
            style={{
              zoom: `${zoom}%`,
              width: zoom > 100 ? `${zoom * 1.2}%` : '100%',
            }}
          >
            <PlannerMonthDaypartGrid
              verborgenWeekdagen={verborgenWeekdagen}
              toonInhoudOpNietInplanbaar
              participant={participants[0]}
              dayparts={visibleDayparts}
              year={overviewMonth.year}
              month={overviewMonth.month}
              renderCell={({ participant, datum, daypart }) => renderCell(participant, datum, daypart)}
              onCellClick={applyCell}
              onCellPointerEnter={(cell, event) => {
                if (event.ctrlKey) void applyCell(cell);
              }}
              /*
                Wat voorbij is kan alleen nog bekeken worden. Een vakje van vorige maand zag er
                net zo aanklikbaar uit als een van volgende week, en pas na de klik kwam de
                melding dat het niet meer mag. Nu gebeurt er niets, wat de melding overbodig
                maakt: de afwezigheden en dienstvoorkeuren die er staan blijven gewoon zichtbaar.
              */
              isCellDisabled={({ datum }) => !editable || isDatumVoorbij(datum)}
              isCellUnavailable={({ participant, datum, daypart }) =>
                !isDaypartSchedulableForParticipant(
                  data.masterData.schedulableDayparts ?? [],
                  participantMatrixFor(
                    data.masterData.participantSchedulableDayparts ?? [],
                    participant.id
                  ),
                  datum,
                  daypart.id
                )
              }
              holidayLabels={holidayData.labels}
              blockedDates={holidayData.publicHolidayDates}
              cursorTool={cursorTool}
              onCursorToolDismiss={dismissCursorTool}
              renderBlockedCell={() => (
                <Image
                  src="/images/icons/party-day-bg.svg"
                  alt="Feestdag"
                  width={32}
                  height={32}
                  className="mx-auto size-8 rounded object-cover"
                />
              )}
            />
          </div>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          {isDoctorMode
            ? 'U bent geen actieve deelnemer in deze waarneemgroep. Kies een andere waarneemgroep of neem contact op met de secretaris.'
            : 'Geen deelnemer beschikbaar.'}
        </p>
      )}

      </div>
    </div>
    </div>
  );
}
