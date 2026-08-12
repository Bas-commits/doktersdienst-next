'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Minus, Moon, Plus, RotateCcw, Sun, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { PraktijkplannerTitleAside, type PraktijkplannerPageContext } from './PraktijkplannerPage';
import { AbsenceDaypartCell } from './AbsenceDaypartCell';
import { PlannerDaypartHoverPreview } from './PlannerDaypartHoverPreview';
import { absenceDisplayBackground, absenceDisplayColor, absenceForegroundIconPath, absencePaletteIconPath, DAYPART_ICONS, sortAbsenceTypesForPalette } from './absence-icons';
import { PlannerChipPalette } from './PlannerChipPalette';
import type { PlannerCursorTool } from './PlannerCursorTool';
import { PlannerDaypartGrid } from './PlannerDaypartGrid';
import { PlannerMonthDaypartGrid } from './PlannerMonthDaypartGrid';
import { PlannerMonthCell, PlannerMonthOverviewGrid } from './PlannerMonthOverviewGrid';
import { PlannerAvondNachtToggle } from './PlannerAvondNachtToggle';
import { PlannerViewModeSwitch } from './PlannerViewModeSwitch';
import { PlannerWeekBar } from './PlannerWeekBar';
import { MonthNavigation } from '@/components/CalandarGrid/MonthNavigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { usePlannerHolidayData } from '@/hooks/praktijkplanner/usePlannerHolidays';
import { usePlannerWeergave } from '@/hooks/praktijkplanner/usePlannerWeergave';
import { deelnemerChipInitials } from '@/lib/deelnemer-display';
import {
  zichtbareDagdelen,
} from '@/lib/praktijkplanner/dagdeel-zichtbaarheid';
import { addDays, maandVanWeek, monthBounds, monthCalendarBounds, weekVanMaand } from '@/lib/praktijkplanner/dates';
import { notifyPlannerChanged } from '@/lib/praktijkplanner/planner-change-broadcast';
import {
  isDaypartSchedulableForParticipant,
  participantMatrixFor,
} from '@/lib/praktijkplanner/schedulable-dayparts';
import type { PraktijkplannerAbsenceSlot, PraktijkplannerDaypart } from '@/types/praktijkplanner';
 


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
  const { weekStart, setWeekStart, viewMode, setViewMode } = usePlannerWeergave(groupId);
  const [slots, setSlots] = useState<PraktijkplannerAbsenceSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [isVoorlopig, setIsVoorlopig] = useState(isDoctorMode);
  const [clearMode, setClearMode] = useState(false);
  const [emailParticipantId, setEmailParticipantId] = useState<number | null>(null);
  const [showNight, setShowNight] = useState(false);
  const [zoom, setZoom] = useState(100);

  // Ook de maandkalender van de dokterversie hangt aan weekStart. Die had een eigen maand en
  // jaar, en dan is er niets wat die twee bij elkaar houdt zodra de schermen elkaar volgen.
  const overviewMonth = useMemo(() => maandVanWeek(weekStart), [weekStart]);
  const overviewMonthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(
        new Date(overviewMonth.year, overviewMonth.month - 1, 1, 12)
      ),
    [overviewMonth]
  );

  const range = useMemo(() => {
    if (!isDoctorMode) {
      if (viewMode === 'month') {
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
  }, [isDoctorMode, overviewMonth, viewMode, weekStart]);
  const holidayData = usePlannerHolidayData(range.start, range.end);
  const participants = isDoctorMode
    ? data.participants.filter((participant) => participant.id === data.userId)
    : data.participants;
  const editable = isDoctorMode || data.isManager;
  const visibleDayparts = useMemo(
    () => zichtbareDagdelen(data.masterData.dayparts, { toonAvondNacht: showNight }),
    [data.masterData.dayparts, showNight]
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

  const slotMap = useMemo(
    () => new Map(slots.map((slot) => [keyFor(slot.iddeelnemer, slot.datum, slot.iddagdeel), slot])),
    [slots]
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
      daypart: PraktijkplannerDaypart,
      // In de maandweergave is een dag 34 pixels breed; daar past het gekleurde vakje met het
      // icoon niet in. De hoverkaart eronder blijft dezelfde en toont het wel.
      variant: 'week' | 'month' = 'week'
    ) => {
      const { absence, provisional } = resolveAbsence(participant.id, datum, daypart.id);
      if (!absence) {
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

      const cell = (
        <AbsenceDaypartCell
          absence={absence}
          provisional={provisional}
          participantColor={participant.color}
          fill
        />
      );

      // Zonder deze kaart vertelt het vakje alleen zijn kleur. De dokterversie toont maar één
      // deelnemer, dus daar zou de naam iedere keer dezelfde regel zijn.
      return (
        <PlannerDaypartHoverPreview
          enabled={!(editable && (clearMode || selectedTypeId != null))}
          participantName={participantName(participant)}
          initials={deelnemerChipInitials(participant)}
          datum={datum}
          daypartName={daypart.naam}
          fromRepetition={false}
          isException={false}
          absence={{ type: absence.naam, aangevraagd: provisional === true }}
          showPlanningDetails={false}
          showParticipant={!isDoctorMode}
          chip={<div className="relative h-full w-full">{cell}</div>}
        >
          {variant === 'month' ? (
            <PlannerMonthCell
              label={absence.naam}
              color={absence.kleur}
              provisional={provisional === true}
            />
          ) : (
            cell
          )}
        </PlannerDaypartHoverPreview>
      );
    },
    [clearMode, editable, isDoctorMode, resolveAbsence, selectedTypeId]
  );

  const isCellFilled = useCallback(
    (iddeelnemer: number, datum: string, daypart: PraktijkplannerDaypart) =>
      resolveAbsence(iddeelnemer, datum, daypart.id).absence != null,
    [resolveAbsence]
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
      if (
        !isDaypartSchedulableForParticipant(
          data.masterData.schedulableDayparts ?? [],
          participantMatrixFor(
            data.masterData.participantSchedulableDayparts ?? [],
            isDoctorMode ? data.userId : participant.id
          ),
          datum,
          daypart.id
        )
      ) {
        return;
      }
      if (!clearMode && selectedTypeId == null) {
        toast.info('Kies eerst een afwezigheidstype.', { position: TOAST_POSITION });
        return;
      }

      const participantId = isDoctorMode ? data.userId : participant.id;
      const key = keyFor(participantId, datum, daypart.id);
      const existing = slotMap.get(key);
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
      selectedTypeId,
      slotMap,
      slots,
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
    return [
      { id: REMOVE_PALETTE_ID, label: 'Leegmaken', color: '#c91b23', background: '#c91b23', icon: REMOVE_PALETTE_ICON },
      ...absenceItems,
    ];
  }, [data.masterData.absenceTypes, isDoctorMode]);

  const selectedPaletteId =
    clearMode || selectedTypeId == null
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
  }, [clearMode, data.masterData.absenceTypes, editable, isDoctorMode, isVoorlopig, selectedTypeId]);

  // Week en maand hangen dezelfde knoppen op, en het moeten dezelfde knoppen in dezelfde
  // volgorde blijven.
  const weergaveKnoppen = (
    <>
      {editable ? (
        <PlannerAvondNachtToggle aan={showNight} onChange={updateVisibility} />
      ) : null}
      <PlannerViewModeSwitch
        value={viewMode}
        onChange={setViewMode}
        monthLabel={overviewMonthLabel}
      />
    </>
  );

  return (
    <div className="space-y-4">
  

      <div className="flex items-start gap-4">
      {/*
        In de maandweergave van de beheerder is er niets aan te klikken, dus het palet zou
        alleen maar uitnodigen tot iets wat niet werkt. De dokterversie heeft zijn eigen
        maandkalender waarin je wel kunt kiezen, en houdt het palet dus.
      */}
      {editable && !(!isDoctorMode && viewMode === 'month') ? (
        <div className="shrink-0 self-stretch">
          {/*
            Het palet begint bovenaan. Het sloeg eerder de hoogte van de navigatie over, want
            die stond boven het rooster; nu staat die in de paginakop en valt er niets meer
            over te slaan.
          */}
          <aside className="sticky top-0" data-planner-tool-keep-active>
            <PlannerChipPalette
            variant="sidebar"
            title={isDoctorMode ? 'Afwezigheid aangeven' : 'Afwezigheidstypen'}
            items={paletteItems}
            selectedId={selectedPaletteId}
            onSelect={(id) => {
              if (id === REMOVE_PALETTE_ID) {
                setClearMode(true);
                setSelectedTypeId(null);
                return;
              }
              const { typeId, provisional } = parsePaletteSelection(id);
              setClearMode(false);
              setSelectedTypeId(typeId);
              setIsVoorlopig(isDoctorMode || provisional);
            }}
            onClear={() => {
              setClearMode(false);
              setSelectedTypeId(null);
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
          </PraktijkplannerTitleAside>
          {editable && viewMode === 'month' ? (
            <p className="rounded-md border bg-muted/40 p-2 text-sm text-muted-foreground">
              De maand is om te kijken. Zet de weergave op Week om een afwezigheid te zetten.
            </p>
          ) : null}
          {viewMode === 'month' ? (
            <PlannerMonthOverviewGrid
              participants={participants}
              dayparts={visibleDayparts}
              year={overviewMonth.year}
              month={overviewMonth.month}
              renderCell={({ participant, datum, daypart }) =>
                renderCell(participant, datum, daypart, 'month')
              }
              holidayLabels={holidayData.labels}
            />
          ) : (
        <PlannerDaypartGrid
          participants={participants}
          dayparts={visibleDayparts}
          weekStart={weekStart}
          renderCell={({ participant, datum, daypart }) => renderCell(participant, datum, daypart)}
          isCellFilled={({ participant, datum, daypart }) => isCellFilled(participant.id, datum, daypart)}
          onCellClick={applyCell}
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
          </PraktijkplannerTitleAside>
          <div className="overflow-x-auto pb-2">
          <div
            style={{
              zoom: `${zoom}%`,
              width: zoom > 100 ? `${zoom * 1.2}%` : '100%',
            }}
          >
            <PlannerMonthDaypartGrid
              participant={participants[0]}
              dayparts={visibleDayparts}
              year={overviewMonth.year}
              month={overviewMonth.month}
              renderCell={({ participant, datum, daypart }) => renderCell(participant, datum, daypart)}
              onCellClick={applyCell}
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
