'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Minus, Moon, Plus, RotateCcw, Sun, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import type { PraktijkplannerPageContext } from './PraktijkplannerPage';
import { AbsenceDaypartCell } from './AbsenceDaypartCell';
import { absenceDisplayBackground, absenceDisplayColor, absenceForegroundIconPath, absencePaletteIconPath, DAYPART_ICONS, sortAbsenceTypesForPalette } from './absence-icons';
import { PlannerChipPalette } from './PlannerChipPalette';
import type { PlannerCursorTool } from './PlannerCursorTool';
import { plannerMonthGridNavOffsetPx, plannerWeekGridNavOffsetPx } from './planner-grid-layout';
import { PlannerDaypartGrid } from './PlannerDaypartGrid';
import { PlannerMonthDaypartGrid } from './PlannerMonthDaypartGrid';
import { MonthNavigation } from '@/components/CalandarGrid/MonthNavigation';
import { PLANNER_GRID_NAV_MARGIN_PX } from './planner-grid-layout';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { usePlannerHolidayData } from '@/hooks/praktijkplanner/usePlannerHolidays';
import { addDays, formatIsoDate, monthCalendarBounds, startOfIsoWeek } from '@/lib/praktijkplanner/dates';
import type { PraktijkplannerAbsenceSlot, PraktijkplannerDaypart } from '@/types/praktijkplanner';
 


const TOAST_POSITION = 'bottom-right' as const;

function keyFor(iddeelnemer: number, datum: string, iddagdeel: number) {
  return `${iddeelnemer}:${datum}:${iddagdeel}`;
}

function currentWeekStart() {
  return startOfIsoWeek(formatIsoDate(new Date()));
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
  const now = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [slots, setSlots] = useState<PraktijkplannerAbsenceSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [isVoorlopig, setIsVoorlopig] = useState(isDoctorMode);
  const [clearMode, setClearMode] = useState(false);
  const [emailParticipantId, setEmailParticipantId] = useState<number | null>(null);
  const [showDay, setShowDay] = useState(true);
  const [showNight, setShowNight] = useState(true);
  const [zoom, setZoom] = useState(100);

  const range = useMemo(() => {
    if (!isDoctorMode) return { start: weekStart, end: addDays(weekStart, 6) };
    return (
      monthCalendarBounds(year, month) ?? {
        start: `${year}-${String(month).padStart(2, '0')}-01`,
        end: `${year}-${String(month).padStart(2, '0')}-28`,
      }
    );
  }, [isDoctorMode, month, weekStart, year]);
  const holidayData = usePlannerHolidayData(range.start, range.end);
  const participants = isDoctorMode
    ? data.participants.filter((participant) => participant.id === data.userId)
    : data.participants;
  const editable = isDoctorMode || data.isManager;
  const visibleMonthDayparts = useMemo(
    () =>
      data.masterData.dayparts.filter((daypart) =>
        daypart.volgorde <= 2 ? showDay : showNight
      ),
    [data.masterData.dayparts, showDay, showNight]
  );

  useEffect(() => {
    if (emailParticipantId != null || data.participants.length === 0) return;
    setEmailParticipantId(data.participants[0].id);
  }, [data.participants, emailParticipantId]);

  useEffect(() => {
    if (!isDoctorMode) return;

    const abortController = new AbortController();
    fetch(`/api/praktijkplanner/voorkeuren?idwaarneemgroep=${groupId}`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { toonDag?: boolean; toonNacht?: boolean };
        if (!response.ok || abortController.signal.aborted) return;
        const nextDay = typeof payload.toonDag === 'boolean' ? payload.toonDag : true;
        const nextNight = typeof payload.toonNacht === 'boolean' ? payload.toonNacht : true;
        setShowDay(nextDay || !nextNight);
        setShowNight(nextNight);
      })
      .catch(() => undefined);

    return () => abortController.abort();
  }, [groupId, isDoctorMode]);

  const updateVisibility = useCallback(
    (nextDay: boolean, nextNight: boolean) => {
      if (!nextDay && !nextNight) {
        toast.error('Kies minimaal Dag of Nacht.');
        return;
      }

      setShowDay(nextDay);
      setShowNight(nextNight);
      void fetch('/api/praktijkplanner/voorkeuren', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idwaarneemgroep: groupId,
          toonDag: nextDay,
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
    (iddeelnemer: number, datum: string, daypart: PraktijkplannerDaypart) => {
      const { absence, provisional } = resolveAbsence(iddeelnemer, datum, daypart.id);
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

      return (
        <AbsenceDaypartCell
          absence={absence}
          provisional={provisional}
          fill
        />
      );
    },
    [isDoctorMode, resolveAbsence]
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

  const changeMonth = useCallback((nextYear: number, nextMonth: number) => {
    if (nextYear === year && nextMonth === month) return;
    setYear(nextYear);
    setMonth(nextMonth);
  }, [month, year]);

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

  const paletteTopOffsetPx = isDoctorMode ? plannerMonthGridNavOffsetPx() : plannerWeekGridNavOffsetPx();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {isDoctorMode ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm">
            <span className="font-medium">Dagdelen</span>
            <label className="flex items-center gap-1.5">
              <Checkbox
                checked={showDay}
                onCheckedChange={(value) => updateVisibility(!!value, showNight)}
              />
              <Sun className="size-4 text-amber-500" aria-hidden />
              <Label className="cursor-pointer">Dag</Label>
            </label>
            <label className="flex items-center gap-1.5">
              <Checkbox
                checked={showNight}
                onCheckedChange={(value) => updateVisibility(showDay, !!value)}
              />
              <Moon className="size-4 text-slate-600" aria-hidden />
              <Label className="cursor-pointer">Nacht</Label>
            </label>
            <span className="flex items-center gap-1 border-l pl-3">
              <button
                type="button"
                className="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Zoom herstellen"
                title="Zoom herstellen"
                disabled={zoom === 100}
                onClick={() => setZoom(100)}
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                className="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Uitzoomen"
                disabled={zoom <= 50}
                onClick={() => setZoom((value) => Math.max(50, value - 10))}
              >
                <Minus className="size-4" />
              </button>
              <span className="min-w-10 text-center text-xs font-medium">{zoom}%</span>
              <button
                type="button"
                className="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Inzoomen"
                disabled={zoom >= 300}
                onClick={() => setZoom((value) => Math.min(300, value + 10))}
              >
                <Plus className="size-4" />
              </button>
            </span>
          </div>
        ) : null}
        {!isDoctorMode && data.isManager ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-2 shadow-sm">
            <select
              value={emailParticipantId ?? ''}
              onChange={(event) => setEmailParticipantId(Number(event.target.value) || null)}
              className="h-8 rounded border bg-background px-2 text-sm"
              aria-label="Deelnemer voor e-mail"
            >
              {data.participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participantName(participant)}
                </option>
              ))}
            </select>
            <button type="button" className="inline-flex items-center gap-1 rounded border px-2 py-1.5 text-sm hover:bg-muted" onClick={email}>
              <Mail className="size-4" /> E-mail
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex items-start gap-4">
      {editable ? (
        <div className="shrink-0 self-stretch">
          <aside
            className="sticky top-0"
            style={{ marginTop: `${paletteTopOffsetPx}px` }}
            data-planner-tool-keep-active
          >
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
        <PlannerDaypartGrid
          participants={participants}
          dayparts={data.masterData.dayparts}
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
          renderCell={({ participant, datum, daypart }) => renderCell(participant.id, datum, daypart)}
          isCellFilled={({ participant, datum, daypart }) => isCellFilled(participant.id, datum, daypart)}
          onCellClick={applyCell}
          isCellDisabled={() => !editable}
          holidayLabels={holidayData.labels}
          cursorTool={cursorTool}
          onCursorToolDismiss={dismissCursorTool}
        />
      ) : participants[0] ? (
        <div>
          <div className="ml-44" style={{ marginBottom: `${PLANNER_GRID_NAV_MARGIN_PX}px` }}>
            <MonthNavigation
              month={month - 1}
              year={year}
              onSelectMonth={(selectedMonth, selectedYear) => changeMonth(selectedYear, selectedMonth + 1)}
            />
          </div>
          <div className="overflow-x-auto pb-2">
          <div
            style={{
              zoom: `${zoom}%`,
              width: zoom > 100 ? `${zoom * 1.2}%` : '100%',
            }}
          >
            <PlannerMonthDaypartGrid
              participant={participants[0]}
              dayparts={visibleMonthDayparts}
              year={year}
              month={month}
              renderCell={({ participant, datum, daypart }) => renderCell(participant.id, datum, daypart)}
              onCellClick={applyCell}
              onCellPointerEnter={(cell, event) => {
                if (event.ctrlKey) void applyCell(cell);
              }}
              isCellDisabled={() => !editable}
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
