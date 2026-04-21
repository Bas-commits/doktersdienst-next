'use client';

import type { CSSProperties, PointerEventHandler } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Check, GraduationCap, Trash2, TreePalm, X } from 'lucide-react';
import { FaQuestion } from "react-icons/fa6";
import { BsFillQuestionSquareFill } from "react-icons/bs";
import { TbSwitch3 } from 'react-icons/tb';
import type { ShiftBlockView } from '@/types/diensten';
import { getContrastTextColor } from '@/utils/contrastTextColor';

/** Returns whether the given date lies within the shift's start and end (inclusive). Exported for testing. */
export function isShiftActiveAt(block: ShiftBlockView, when: Date): boolean {
  try {
    // Dates are stored as "Y-m-d H:i:s"; parse as full datetime.
    const startStr = String(block.currentDate).replace(' ', 'T');
    const endStr = String(block.nextDate).replace(' ', 'T');
    const start = new Date(startStr);
    const end = new Date(endStr);
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return false;
    }
    const t = when.getTime();
    return t >= startMs && t <= endMs;
  } catch {
    return false;
  }
}

export interface ShiftBlockProps {
  block: ShiftBlockView;
  day: number;
  month: number;
  year: number;
  /**
   * Width in pixels representing the full 00:00–24:00 time range for this block.
   * When omitted, left and width use percentages so the block scales with its parent.
   */
  containerWidth?: number;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /**
   * Which sub-section of the shift block is the click target.
   * - undefined / 'middle' (default): clicking the main middle strip fires onClick (existing behaviour).
   * - 'top': clicking the Achterwacht strip fires onClick; middle is inert.
   * - 'bottom': clicking the Extra Dokter strip fires onClick; middle is inert.
   * Pages that do not pass this prop (Rooster, Overname) are unaffected.
   */
  activeSection?: 'top' | 'middle' | 'bottom';
  /**
   * When true, the top (Achterwacht) strip shows a gray border when empty,
   * even when shift type is not 1. Default false preserves existing behaviour.
   */
  showEmptyTopStripBorder?: boolean;
  /**
   * When true, the bottom (Extra Dokter) strip shows a gray border when empty,
   * even when shift type is not 1. Default false preserves existing behaviour.
   */
  showEmptyBottomStripBorder?: boolean;
  /**
   * When true, the top (Achterwacht) strip is not rendered at all.
   */
  hideTopStrip?: boolean;
  /**
   * When true, the bottom (Extra Dokter) strip is not rendered at all.
   */
  hideBottomStrip?: boolean;
  /**
   * When set and chip is an unassigned slot (type 1), the middle strip shows this
   * doctor's color and initials (e.g. pending assign in planner).
   */
  pendingDoctor?: { color: string; shortName: string };
  /**
   * When set, the top (Achterwacht) strip shows this doctor's color and initials when empty.
   */
  pendingDoctorTop?: { color: string; shortName: string };
  /**
   * When set, the bottom (Extra) strip shows this doctor's color and initials when empty.
   */
  pendingDoctorBottom?: { color: string; shortName: string };
  /**
   * When provided, each stripe is clicked independently and this is called with section and event.
   * Clickability: top when showEmptyTopStripBorder, middle always, bottom when showEmptyBottomStripBorder.
   * When not set, onClick + activeSection are used (existing behaviour).
   */
  onSectionClick?: (section: 'top' | 'middle' | 'bottom', e: React.MouseEvent<HTMLDivElement>) => void;
  /**
   * When set, these stripes are shown dimmed (e.g. pending remove in planner).
   */
  pendingRemoveSections?: Set<'top' | 'middle' | 'bottom'>;
  /**
   * When set, a delete button is shown on the block (e.g. shift-toevoegen page).
   * Clicking it calls onDelete and does not trigger onClick.
   */
  onDelete?: () => void;
  /**
   * When set with segmentEndTime, this block is drawn as a day-segment (e.g. overnight shift
   * split across days). Layout left/width use these times instead of block.startTime/endTime.
   * Tooltip still shows full block times.
   */
  segmentStartTime?: string;
  segmentEndTime?: string;
  /**
   * When true, this segment continues from the previous day (same shift across midnight).
   * Removes left border so it connects visually with the previous cell.
   */
  continuesFromPrev?: boolean;
  /**
   * When true, this segment continues to the next day (same shift across midnight).
   * Removes right border so it connects visually with the next cell.
   */
  continuesToNext?: boolean;
  /**
   * When set (voorkeuren), shows a small preference chip icon on the middle strip.
   * Use Weghalen (code 1014, empty chipIconPath) to show Trash2 for "remove" state.
   */
  preferenceChip?: { code: string; label: string; chipIconPath: string } | null;
  /**
   * When true and the middle strip uses filled preference styling (icon + solid color),
   * initials from block.middle are hidden so only the icon shows. Use on /voorkeuren
   * where the viewer is always the current user; secretaris multi-user band keeps initials.
   */
  hideInitialsInPreferenceFill?: boolean;
  /**
   * When set, overrides the default 42px middle strip height.
   * Use 20 for compact preference-only blocks in the secretaris rooster view.
   */
  middleHeight?: number;
  /**
   * When true, suppresses the red active-shift border even when the shift is currently active.
   * Use for voorkeur blocks where the time range is a preference period, not a live shift.
   */
  disableActiveHighlight?: boolean;
  /**
   * When set, shows an overname (shift takeover) indicator on the block.
   * - 'overname': confirmed takeover — small TbSwitch3 badge top-right
   * - 'voorstelOvername': pending confirmation — TbSwitch3 + orange TbQuestionMark badge
   * - 'vraagtekenOvername': declined, no replacement — red question badge top-right
   */
  overnameType?: 'overname' | 'voorstelOvername' | 'vraagtekenOvername';
  /**
   * When set (e.g. voorkeuren paint-drag), middle strip uses pointer events instead of onClick
   * so click-and-drag across blocks does not double-fire on tap.
   */
  onMiddlePointerDown?: PointerEventHandler<HTMLDivElement>;
  onMiddlePointerEnter?: PointerEventHandler<HTMLDivElement>;
}

export function ShiftBlock({
  block,
  day,
  month,
  year,
  containerWidth,
  onClick,
  activeSection,
  showEmptyTopStripBorder,
  showEmptyBottomStripBorder,
  hideTopStrip,
  hideBottomStrip,
  pendingDoctor,
  pendingDoctorTop,
  pendingDoctorBottom,
  onSectionClick,
  pendingRemoveSections,
  onDelete,
  segmentStartTime,
  segmentEndTime,
  continuesFromPrev,
  continuesToNext,
  preferenceChip,
  hideInitialsInPreferenceFill = false,
  middleHeight,
  disableActiveHighlight,
  overnameType,
  onMiddlePointerDown,
  onMiddlePointerEnter,
}: ShiftBlockProps) {
  const [now, setNow] = useState(() => new Date());
  const [isHovered, setIsHovered] = useState(false);
  const [shiftTooltipOpen, setShiftTooltipOpen] = useState(false);
  const [shiftTooltipCoords, setShiftTooltipCoords] = useState<{ left: number; top: number } | null>(
    null,
  );
  /** True while pointer is on the overname/voorstel badge or its hover panel (hides the shift tooltip to avoid overlap). */
  const [overnameHoverDetailOpen, setOvernameHoverDetailOpen] = useState(false);
  const shiftTooltipAnchorRef = useRef<HTMLDivElement>(null);
  const showShiftTooltipPortal = shiftTooltipOpen && !overnameHoverDetailOpen;

  useLayoutEffect(() => {
    if (!showShiftTooltipPortal) return;
    const el = shiftTooltipAnchorRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setShiftTooltipCoords({ left: r.left + r.width / 2, top: r.bottom + 4 });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showShiftTooltipPortal]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const isActive = useMemo(
    () => !disableActiveHighlight && isShiftActiveAt(block, now),
    [block, now, disableActiveHighlight],
  );

  const doctorId = block.middle?.id ?? 0;
  const achterw = block.top?.id ?? 0;
  const extra = block.bottom?.id ?? 0;

  const startDate = new Date(block.currentDate);
  const endDate = new Date(block.nextDate);
  const startIsWeekend = startDate.getDay() === 0 || startDate.getDay() === 6;
  const endIsWeekend = endDate.getDay() === 0 || endDate.getDay() === 6;
  const cellDate = new Date(year, month, day);
  const isMonday = cellDate.getDay() === 1;

  const totalMinutesInDay = 24 * 60;
  const parseTimeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map((part) => Number(part));
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    const minutes = h * 60 + m;
    if (minutes < 0) return 0;
    if (minutes > totalMinutesInDay) return totalMinutesInDay;
    return minutes;
  };

  const useSegment =
    segmentStartTime != null && segmentEndTime != null && segmentStartTime !== '' && segmentEndTime !== '';
  const startMinutes = useSegment
    ? parseTimeToMinutes(segmentStartTime)
    : parseTimeToMinutes(block.startTime);
  const endMinutes = useSegment
    ? parseTimeToMinutes(segmentEndTime)
    : parseTimeToMinutes(block.endTime);
  const sameDay = endMinutes >= startMinutes;
  const durationMinutes = sameDay
    ? endMinutes - startMinutes
    : (totalMinutesInDay - startMinutes) + endMinutes;

  const usePixelLayout =
    containerWidth != null && Number.isFinite(containerWidth) && containerWidth > 0;
  const safeContainerWidth = usePixelLayout ? containerWidth! : 1;
  const leftPx = (startMinutes / totalMinutesInDay) * safeContainerWidth;
  const widthPx = (durationMinutes / totalMinutesInDay) * safeContainerWidth;
  const leftPercent = (startMinutes / totalMinutesInDay) * 100;
  const widthPercent = (durationMinutes / totalMinutesInDay) * 100;

  let cssInline: CSSProperties = {};
  if (doctorId !== 0) {
    if (!isMonday && startIsWeekend && !endIsWeekend) {
      cssInline = { borderRightStyle: 'none' };
    } else if (isMonday && startIsWeekend) {
      cssInline = { borderLeftStyle: 'none' };
    }
  } else {
    if (!isMonday && startIsWeekend && !endIsWeekend) {
      cssInline = { borderRightStyle: 'none' };
    } else if (isMonday && startIsWeekend) {
      cssInline = { borderLeftStyle: 'none' };
    }
  }
  const isSunday = cellDate.getDay() === 0;

  // Flags for applying edge gradients when a segment continues across rows (Sunday→Monday).
  const hasLeftEdgeGradient = !!continuesFromPrev && isMonday;
  const hasRightEdgeGradient = !!continuesToNext && isSunday;

  // Compute rounded corner classes based on continuity across midnight
  const middleRoundedClass =
    continuesFromPrev && continuesToNext ? '' :
    continuesFromPrev ? 'rounded-r-[3px]' :
    continuesToNext ? 'rounded-l-[3px]' :
    'rounded-[3px]';
  const stripRoundedClass =
    continuesFromPrev && continuesToNext ? '' :
    continuesFromPrev ? 'rounded-r-[3px]' :
    continuesToNext ? 'rounded-l-[3px]' :
    'rounded-[3px]';

  if (continuesFromPrev) {
    // Seamless join on the left; extra visual cue handled via gradient flags above.
    cssInline = { ...cssInline, borderLeftStyle: 'none' };
  }
  if (continuesToNext) {
    // Seamless join on the right; extra visual cue handled via gradient flags above.
    cssInline = { ...cssInline, borderRightStyle: 'none' };
  }

  const achterwDoc = block.top ?? null;
  const extraDoc = block.bottom ?? null;
  const mainDoc = block.middle ?? null;
  const displayShortName =
    (mainDoc?.shortName ?? '').trim() ||
    (mainDoc?.name ?? '').slice(0, 3).toUpperCase() ||
    (doctorId ? `#${doctorId}` : '');
  const displayName = (mainDoc?.name ?? '').trim() || (doctorId ? `Doctor ${doctorId}` : '');

  const mainColor = mainDoc?.color ?? (doctorId ? '#c686fd' : 'transparent');
  const isUnassignedSlot = !block.middle;
  const showPendingDoctor = isUnassignedSlot && pendingDoctor != null;

  const aantekeningLabel = (block.aantekeningTekst ?? '').trim();
  const aantekeningTextClass =
    doctorId || showPendingDoctor ? '' : 'text-[#4b5563]';

  if (isUnassignedSlot) {
    // Type 1 = shift slot: gray outline, or pending doctor color/initials when assigned in planner
    cssInline = {
      ...cssInline,
      backgroundColor: showPendingDoctor ? pendingDoctor!.color : 'transparent',
      border: showPendingDoctor ? undefined : '1px solid #dcdcdc',
      minHeight: 42,
    };
  } else {
    cssInline = { ...cssInline, backgroundColor: mainColor };
  }
  if (!isUnassignedSlot && (doctorId || achterw || extra)) {
    cssInline = { ...cssInline, minHeight: middleHeight ?? 42 };
  }

  // Apply linear gradients on the left/right edges when the segment continues across rows.
  if (!isUnassignedSlot && (hasLeftEdgeGradient || hasRightEdgeGradient) && mainColor && mainColor !== 'transparent') {
    const backgroundColor = (cssInline.backgroundColor as string) || mainColor;

    const gradientLayers: string[] = [];
    const positions: string[] = [];
    const sizes: string[] = [];

    if (hasLeftEdgeGradient) {
      gradientLayers.push(`linear-gradient(to left, ${backgroundColor}, #ffffff)`);
      positions.push('left top');
      sizes.push('8px 100%');
    }
    if (hasRightEdgeGradient) {
      gradientLayers.push(`linear-gradient(to right, ${backgroundColor}, #ffffff)`);
      positions.push('right top');
      sizes.push('8px 100%');
    }

    const existingImage = cssInline.backgroundImage as string | undefined;
    const mergedImages = [gradientLayers.join(', '), existingImage].filter(Boolean).join(', ');

    cssInline = {
      ...cssInline,
      backgroundColor,
      backgroundImage: mergedImages || undefined,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: positions.join(', ') || undefined,
      backgroundSize: sizes.join(', ') || undefined,
    };
  }

  // When onSectionClick is set, each stripe is clickable by its show prop; otherwise use activeSection + onClick.
  const useSectionClick = onSectionClick != null;
  const topStripClickable = useSectionClick ? !!showEmptyTopStripBorder : activeSection === 'top';
  const middleStripClickable = useSectionClick ? true : (activeSection === undefined || activeSection === 'middle');
  const bottomStripClickable = useSectionClick ? !!showEmptyBottomStripBorder : activeSection === 'bottom';
  const topHasClick = topStripClickable && (useSectionClick ? onSectionClick : onClick);
  const middleUsesPointerPaint = !useSectionClick && onMiddlePointerDown != null;
  const middleHasClick =
    middleStripClickable &&
    (useSectionClick ? onSectionClick : onClick || onMiddlePointerDown);
  const bottomHasClick = bottomStripClickable && (useSectionClick ? onSectionClick : onClick);

  const topPending = achterw === 0 && pendingDoctorTop;
  const bottomPending = extra === 0 && pendingDoctorBottom;
  const dimTop = pendingRemoveSections?.has('top');
  const dimMiddle = pendingRemoveSections?.has('middle');
  const dimBottom = pendingRemoveSections?.has('bottom');

  /** Filled preference styles: block background + Lucide icon (Liever wel, Liever niet, Vakantie, Nascholing). */
  const preferenceFill = useMemo(() => {
    if (!preferenceChip) return null;
    const map: Record<string, { backgroundColor: string; Icon: typeof Check }> = {
      '3': { backgroundColor: '#22c55e', Icon: Check },
      '2': { backgroundColor: '#eab308', Icon: X },
      '9': { backgroundColor: '#ef4444', Icon: TreePalm },
      '10': { backgroundColor: '#a855f7', Icon: GraduationCap },
      '5001': { backgroundColor: '#64748b', Icon: Briefcase },
    };
    return map[preferenceChip.code] ?? null;
  }, [preferenceChip]);

  const showPreferenceFill = preferenceFill != null;

  const preferenceTextColor = useMemo(
    () => (preferenceFill ? getContrastTextColor(preferenceFill.backgroundColor) : null),
    [preferenceFill],
  );

  const middleStripTextColor = useMemo(() => {
    if (showPreferenceFill && preferenceFill) {
      return getContrastTextColor(preferenceFill.backgroundColor);
    }
    if (showPendingDoctor && pendingDoctor) {
      return getContrastTextColor(pendingDoctor.color);
    }
    if (doctorId && mainColor && mainColor !== 'transparent') {
      return getContrastTextColor(mainColor);
    }
    return null;
  }, [
    showPreferenceFill,
    preferenceFill,
    showPendingDoctor,
    pendingDoctor,
    doctorId,
    mainColor,
  ]);

  const topStripTextColor = useMemo(() => {
    if (topPending && pendingDoctorTop) {
      return getContrastTextColor(pendingDoctorTop.color);
    }
    if (achterwDoc?.color) {
      return getContrastTextColor(achterwDoc.color);
    }
    return null;
  }, [topPending, pendingDoctorTop, achterwDoc]);

  const bottomStripTextColor = useMemo(() => {
    if (bottomPending && pendingDoctorBottom) {
      return getContrastTextColor(pendingDoctorBottom.color);
    }
    if (extraDoc?.color) {
      return getContrastTextColor(extraDoc.color);
    }
    return null;
  }, [bottomPending, pendingDoctorBottom, extraDoc]);
  const showPreferenceBadge = preferenceChip != null && !showPreferenceFill;
  const overnameTypeLabel = block.isPartial ? 'Gedeeltelijke overname' : 'Volledige overname';
  const overnameStatusLabel =
    overnameType === 'voorstelOvername' ? 'In afwachting' :
    overnameType === 'overname' ? 'Goedgekeurd' :
    null;
  const overnameStatusClass =
    overnameType === 'voorstelOvername'
      ? 'bg-orange-100 text-orange-800'
      : overnameType === 'overname'
        ? 'bg-green-100 text-green-800'
        : '';
  const vanDateLabel = new Date(block.van * 1000).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const totDateLabel = new Date(block.tot * 1000).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const vanArts = block.originalDoctor;
  const naarArts = block.middle;

  return (
    <div
      className="absolute"
      data-box-type="morning"
      data-active-shift={isActive ? 'true' : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        top: '50%',
        // Extend 1px on connecting sides to visually cover the 1px day-column divider border
        width: usePixelLayout
          ? `${widthPx + (continuesFromPrev ? 1 : 0) + (continuesToNext ? 1 : 0)}px`
          : (continuesFromPrev || continuesToNext)
            ? `calc(${widthPercent}% + ${(continuesFromPrev ? 1 : 0) + (continuesToNext ? 1 : 0)}px)`
            : `${widthPercent}%`,
        left: usePixelLayout
          ? `${leftPx + (continuesFromPrev ? -1 : 0)}px`
          : continuesFromPrev
            ? `calc(${leftPercent}% - 1px)`
            : `${leftPercent}%`,
        transform: 'translateY(-50%)',
        zIndex: isHovered ? 9999 : (continuesFromPrev || continuesToNext) ? 1 : undefined,
      }}
    >
      {onDelete && (
        <button
          type="button"
          className="shift-block-delete absolute top-0.5 right-0.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-red-500/90 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Shift verwijderen"
          data-testid="shift-block-delete"
        >
          <Trash2 className="h-3 w-3" aria-hidden />
        </button>
      )}
      {!hideTopStrip &&
        (achterw === 0 ? (
          <div
            className={`h-3 ${stripRoundedClass} text-[10px] text-center leading-3 font-bold tracking-[0.5px] mb-1.5${topStripClickable ? ' cursor-pointer' : ''}`}
            data-doctor="111"
            data-testid="shift-block-top"
            style={{
              background: topPending ? pendingDoctorTop!.color : 'transparent',
              border: achterwDoc ? undefined : 'solid 1px #dcdcdc',
              cursor: topHasClick ? 'pointer' : undefined,
              opacity: dimTop ? 0.35 : undefined,
              color: topStripTextColor ?? '#ffffff',
            }}
            onClick={topHasClick ? (e) => useSectionClick ? onSectionClick!('top', e) : onClick!(e) : undefined}
          >
            {topPending ? (pendingDoctorTop!.shortName) : null}
          </div>
        ) : (
          <div
            className={`h-3 ${stripRoundedClass} text-[10px] text-center leading-3 font-bold tracking-[0.5px] mb-1.5${topStripClickable ? ' cursor-pointer' : ''}`}
            data-doctor={achterw}
            data-testid="shift-block-top"
            style={{
              background: achterwDoc?.color ?? 'transparent',
              cursor: topHasClick ? 'pointer' : undefined,
              opacity: dimTop ? 0.35 : undefined,
              color: topStripTextColor ?? '#ffffff',
            }}
            onClick={topHasClick ? (e) => useSectionClick ? onSectionClick!('top', e) : onClick!(e) : undefined}
          >
            {(achterwDoc?.shortName ?? '').trim() ||
              (achterwDoc?.name ?? '').slice(0, 3).toUpperCase() ||
              `#${achterw}`}
          </div>
        ))}
      <>
        <div
          ref={shiftTooltipAnchorRef}
          onMouseEnter={() => setShiftTooltipOpen(true)}
          onMouseLeave={() => {
            setShiftTooltipOpen(false);
            setShiftTooltipCoords(null);
          }}
          className={`@container flex mt-1 mb-1 items-center justify-between relative border border-[#a0a0a0] ${middleRoundedClass} ${doctorId ? 'active-day' : ''} ${showPreferenceFill ? 'justify-center' : ''}`}
          data-testid="shift-block-middle"
          data-doctor={doctorId}
          data-current-date={block.currentDate}
          data-next-date={block.nextDate}
          data-date={day}
          data-month={month}
          data-year={year}
          data-morning={doctorId}
          style={{
            height: middleHeight ?? 42,
            ...cssInline,
            ...(showPreferenceFill
              ? {
                  backgroundColor: preferenceFill!.backgroundColor,
                  backgroundImage: undefined,
                  border: '1px solid rgba(0,0,0,0.15)',
                }
              : {}),
            // Re-apply continuation overrides: the `border` shorthand above resets borderLeft/RightStyle,
            // so we must restore 'none' afterwards for multi-day blocks to connect seamlessly.
            ...(continuesFromPrev ? { borderLeftStyle: 'none' as const } : {}),
            ...(continuesToNext ? { borderRightStyle: 'none' as const } : {}),
            ...(middleHasClick ? { cursor: 'pointer' as const } : {}),
            ...(dimMiddle ? { opacity: 0.35 } : {}),
            ...(isActive ? {
              borderColor: '#dc2626',
              borderTopWidth: '3px',
              borderBottomWidth: '3px',
              borderLeftWidth: continuesFromPrev ? '0' : '3px',
              borderRightWidth: continuesToNext ? '0' : '3px',
              zIndex: 1,
            } : {}),
          }}
          onClick={
            middleHasClick && !middleUsesPointerPaint
              ? (e) => (useSectionClick ? onSectionClick!('middle', e) : onClick!(e))
              : undefined
          }
          onPointerDown={middleUsesPointerPaint ? onMiddlePointerDown : undefined}
          onPointerEnter={middleUsesPointerPaint ? onMiddlePointerEnter : undefined}
          title={
            [preferenceChip?.label, aantekeningLabel || undefined].filter(Boolean).join(' — ') || undefined
          }
        >
          {showPreferenceFill ? (() => {
            const { Icon } = preferenceFill!;
            const showInitialsWithPreferenceFill =
              !hideInitialsInPreferenceFill && Boolean(displayShortName);
            return (
              <div className="flex flex-col items-center justify-center min-w-0 max-w-full gap-0.5">
                {showInitialsWithPreferenceFill ? (
                  <span className="flex items-center">
                    <span
                      className="hidden @[36px]:inline text-[8px] font-bold leading-none pl-0.5"
                      style={{ color: preferenceTextColor! }}
                    >
                      {displayShortName}
                    </span>
                    <Icon
                      className="h-3 w-3 shrink-0 pr-0.5"
                      style={{ color: preferenceTextColor! }}
                      aria-hidden
                    />
                  </span>
                ) : (
                  <Icon className="h-5 w-5 shrink-0" style={{ color: preferenceTextColor! }} aria-hidden />
                )}
                {/* {aantekeningLabel ? (
                  <span
                    className="hidden @[36px]:inline text-[7px] font-semibold text-center leading-tight truncate max-w-full px-0.5"
                    style={{ color: preferenceTextColor!, opacity: 0.95 }}
                  >
                    {aantekeningLabel}
                  </span>
                ) : null} */}
              </div>
            );
          })() : (
            <>
              <span
                className={`rotate-180 whitespace-nowrap text-sm font-mono ${middleStripTextColor ? '' : 'text-[#a0a0a0]'}`}
                style={{
                  writingMode: 'vertical-rl',
                  ...(middleStripTextColor ? { color: middleStripTextColor } : {}),
                }}
              />
              {(() => {
                const primaryLabel = showPendingDoctor ? pendingDoctor!.shortName : displayShortName;
                return (
                  <div className="hidden @[1px]:flex flex-col items-center justify-center min-w-0 max-w-full gap-0 px-0.5">
                    {primaryLabel ? (
                      <span
                        className={`text-[10px] font-semibold tracking-[0.5px] wrap-break-word leading-[12px] text-center truncate max-w-full ${
                          middleStripTextColor ? '' : 'text-[#a0a0a0]'
                        }`}
                        style={middleStripTextColor ? { color: middleStripTextColor } : undefined}
                      >
                        {primaryLabel}
                      </span>
                    ) : null}
                    {!primaryLabel && aantekeningLabel ? (
                      <span
                        className={`text-[8px] font-medium leading-tight text-center truncate max-w-full ${aantekeningTextClass}`}
                        style={
                          middleStripTextColor
                            ? { color: middleStripTextColor, opacity: 0.9 }
                            : undefined
                        }
                      >
                        {aantekeningLabel}
                      </span>
                    ) : null}
                  </div>
                );
              })()}
              <span
                className={`rotate-180 whitespace-nowrap text-sm font-mono ${middleStripTextColor ? '' : 'text-[#a0a0a0]'}`}
                style={{
                  writingMode: 'vertical-rl',
                  ...(middleStripTextColor ? { color: middleStripTextColor } : {}),
                }}
              />
            </>
          )}
          {showPreferenceBadge && (
            <span
              className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded bg-black/30 pointer-events-none"
              title={preferenceChip!.label}
              aria-hidden
            >
              {preferenceChip!.chipIconPath ? (
                <img
                  src={preferenceChip!.chipIconPath}
                  alt=""
                  className="h-3 w-3 object-contain"
                />
              ) : (
                <Trash2 className="h-3 w-3 text-white" aria-hidden />
              )}
            </span>
          )}
          {overnameType === 'overname' && (
            <span
              className="group/overname absolute top-0.5 right-0.5 hidden @[36px]:flex h-5 w-5 items-center justify-center rounded bg-black/40"
              title="Overname"
              aria-hidden
              data-testid="overname-badge"
              onMouseEnter={() => setOvernameHoverDetailOpen(true)}
              onMouseLeave={() => setOvernameHoverDetailOpen(false)}
            >
              <TbSwitch3 className="h-3.5 w-3.5 text-white" />
              <div
                className="hidden group-hover/overname:block absolute top-full right-0 z-101 mt-2 w-[260px] rounded-lg border border-gray-300 bg-white p-3 text-[#333] shadow-lg"
                data-testid="overname-hover-popover"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{overnameTypeLabel}</p>
                  {overnameStatusLabel && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${overnameStatusClass}`}>
                      {overnameStatusLabel}
                    </span>
                  )}
                </div>
                <div className="mb-2 flex text-sm">
                  <p className="mb-0">Van: <br /> Tot:</p>
                  <p className="mb-0 ml-2">
                    {vanDateLabel} <strong>{block.startTime}</strong>
                    <br />
                    {totDateLabel} <strong>{block.endTime}</strong>
                  </p>
                </div>
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <p className="font-bold">Van:</p>
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold"
                    style={{
                      backgroundColor: vanArts?.color ?? '#7b2d8e',
                      color: getContrastTextColor(vanArts?.color ?? '#7b2d8e'),
                    }}
                  >
                    {vanArts?.shortName ?? '??'}
                  </span>
                  <p className="font-medium leading-tight">{vanArts?.name ?? 'Onbekend'}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <p className="font-bold">Naar:</p>
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold"
                    style={{
                      backgroundColor: naarArts?.color ?? '#7b2d8e',
                      color: getContrastTextColor(naarArts?.color ?? '#7b2d8e'),
                    }}
                  >
                    {naarArts?.shortName ?? '??'}
                  </span>
                  <p className="font-medium leading-tight">{naarArts?.name ?? 'Onbekend'}</p>
                </div>
              </div>
            </span>
          )}
          {overnameType === 'voorstelOvername' && (
            <span
              className="group/voorstel-overname absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded bg-black/40"
              title="Voorstel overname"
              aria-hidden
              data-testid="voorstel-overname-badge"
              onMouseEnter={() => setOvernameHoverDetailOpen(true)}
              onMouseLeave={() => setOvernameHoverDetailOpen(false)}
            >
              <img src="request.svg" alt="Voorstel overname" className="h-3.5 w-3.5" style={{ filter: 'invert(47%) sepia(97%) saturate(2098%) hue-rotate(2deg) brightness(106%) contrast(101%)' }} />
              <div
                className="hidden group-hover/voorstel-overname:block absolute top-full right-0 z-101 mt-2 w-[260px] rounded-lg border border-gray-300 bg-white p-3 text-[#333] shadow-lg"
                data-testid="voorstel-overname-hover-popover"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{overnameTypeLabel}</p>
                  {overnameStatusLabel && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${overnameStatusClass}`}>
                      {overnameStatusLabel}
                    </span>
                  )}
                </div>
                <div className="mb-2 flex text-sm">
                  <p className="mb-0">Van: <br /> Tot:</p>
                  <p className="mb-0 ml-2">
                    {vanDateLabel} <strong>{block.startTime}</strong>
                    <br />
                    {totDateLabel} <strong>{block.endTime}</strong>
                  </p>
                </div>
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <p className="font-bold">Van:</p>
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold"
                    style={{
                      backgroundColor: vanArts?.color ?? '#7b2d8e',
                      color: getContrastTextColor(vanArts?.color ?? '#7b2d8e'),
                    }}
                  >
                    {vanArts?.shortName ?? '??'}
                  </span>
                  <p className="font-medium leading-tight">{vanArts?.name ?? 'Onbekend'}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <p className="font-bold">Naar:</p>
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold"
                    style={{
                      backgroundColor: naarArts?.color ?? '#7b2d8e',
                      color: getContrastTextColor(naarArts?.color ?? '#7b2d8e'),
                    }}
                  >
                    {naarArts?.shortName ?? '??'}
                  </span>
                  <p className="font-medium leading-tight">{naarArts?.name ?? 'Onbekend'}</p>
                </div>
              </div>
            </span>
          )}
          {overnameType === 'vraagtekenOvername' && (
            <span
              className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded bg-black/40 pointer-events-none"
              title="Overname geweigerd — geen arts toegewezen"
              aria-hidden
              data-testid="vraagteken-overname-badge"
            >
              <FaQuestion className="h-3.5 w-3.5 text-white" />
            </span>
          )}
        </div>
        {showShiftTooltipPortal &&
          shiftTooltipCoords &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              data-shift-block-tooltip
              className="relative flex min-w-[90px] w-max min-h-[45px] border-2 rounded-md list-none items-center pointer-events-none px-2 py-1 after:content-[''] after:absolute after:left-1/2 after:top-[-8px] after:-translate-x-1/2 after:rotate-45 after:w-3 after:h-3 after:border-t-2 after:border-l-2 after:[border-top-color:var(--afterBorder)] after:[border-left-color:var(--afterBorder)]"
              style={{
                position: 'fixed',
                left: shiftTooltipCoords.left,
                top: shiftTooltipCoords.top,
                transform: 'translate(-50%, 0)',
                zIndex: 100000,
                ['--afterBorder' as string]: mainColor,
                borderColor: mainColor,
              }}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <p className="font-bold m-0 rotate-180 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
                  {block.startTime}
                </p>
                <p className="mb-0 font-bold leading-[17px] text-center">
                  {doctorId ? displayName : block.label}
                  {doctorId !== 0 && block.label ? (
                    <span className="block text-[10px]">{block.label}</span>
                  ) : null}
                  {aantekeningLabel ? (
                    <span className="block text-[10px] font-normal opacity-90">{aantekeningLabel}</span>
                  ) : null}
                </p>
                <p className="font-bold m-0 rotate-180 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
                  {block.endTime}
                </p>
              </div>
            </div>,
            document.body,
          )}
      </>
      {!hideBottomStrip &&
        (extra === 0 ? (
          <div
            className={`h-3 ${stripRoundedClass} text-[10px] text-center leading-3 font-bold tracking-[0.5px] mt-1.5${bottomStripClickable ? ' cursor-pointer' : ''}`}
            data-doctor="111"
            data-testid="shift-block-bottom"
            style={{
              background: bottomPending ? pendingDoctorBottom!.color : 'transparent',
              border: extraDoc ? undefined : 'solid 1px #dcdcdc',
              cursor: bottomHasClick ? 'pointer' : undefined,
              opacity: dimBottom ? 0.35 : undefined,
              color: bottomStripTextColor ?? '#ffffff',
            }}
            onClick={bottomHasClick ? (e) => useSectionClick ? onSectionClick!('bottom', e) : onClick!(e) : undefined}
          >
            {bottomPending ? (pendingDoctorBottom!.shortName) : null}
          </div>
        ) : (
          <div
            className={`h-3 ${stripRoundedClass} text-[10px] text-center leading-3 font-bold tracking-[0.5px] mt-1.5${bottomStripClickable ? ' cursor-pointer' : ''}`}
            data-doctor={extra}
            data-testid="shift-block-bottom"
            style={{
              background: extraDoc?.color ?? 'transparent',
              cursor: bottomHasClick ? 'pointer' : undefined,
              opacity: dimBottom ? 0.35 : undefined,
              color: bottomStripTextColor ?? '#ffffff',
            }}
            onClick={bottomHasClick ? (e) => useSectionClick ? onSectionClick!('bottom', e) : onClick!(e) : undefined}
          >
            {(extraDoc?.shortName ?? '').trim() ||
              (extraDoc?.name ?? '').slice(0, 3).toUpperCase() ||
              `#${extra}`}
          </div>
        ))}
    </div>
  );
}
