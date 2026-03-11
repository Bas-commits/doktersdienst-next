import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ShiftBlockView } from '@/types/diensten';

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
}: ShiftBlockProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const isActive = useMemo(() => isShiftActiveAt(block, now), [block, now]);

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
      cssInline = { borderRightStyle: 'none', boxShadow: '-5px 0px 6px #fff inset' };
    } else if (isMonday && startIsWeekend) {
      cssInline = { borderLeftStyle: 'none', boxShadow: '5px 0px 6px #fff inset' };
    }
  } else {
    if (!isMonday && startIsWeekend && !endIsWeekend) {
      cssInline = { borderRightStyle: 'none' };
    } else if (isMonday && startIsWeekend) {
      cssInline = { borderLeftStyle: 'none' };
    }
  }
  const isSunday = cellDate.getDay() === 0;

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
    if (isMonday) {
      // Cross-week boundary (Sunday→Monday row): apply inset shadow
      cssInline = { ...cssInline, borderLeftStyle: 'none', boxShadow: '5px 0px 6px #fff inset' };
    } else {
      // Within same week row (overnight): seamless, no shadow
      cssInline = { ...cssInline, borderLeftStyle: 'none' };
    }
  }
  if (continuesToNext) {
    const existingShadow = cssInline.boxShadow ?? '';
    if (isSunday) {
      // Cross-week boundary (Sunday→Monday row): apply inset shadow
      const rightInset = '-5px 0px 6px #fff inset';
      cssInline = { ...cssInline, borderRightStyle: 'none', boxShadow: existingShadow ? `${existingShadow}, ${rightInset}` : rightInset };
    } else {
      // Within same week row (overnight): seamless, no shadow
      cssInline = { ...cssInline, borderRightStyle: 'none' };
    }
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
    cssInline = { ...cssInline, minHeight: 42 };
  }

  // When onSectionClick is set, each stripe is clickable by its show prop; otherwise use activeSection + onClick.
  const useSectionClick = onSectionClick != null;
  const topStripClickable = useSectionClick ? !!showEmptyTopStripBorder : activeSection === 'top';
  const middleStripClickable = useSectionClick ? true : (activeSection === undefined || activeSection === 'middle');
  const bottomStripClickable = useSectionClick ? !!showEmptyBottomStripBorder : activeSection === 'bottom';
  const topHasClick = topStripClickable && (useSectionClick ? onSectionClick : onClick);
  const middleHasClick = middleStripClickable && (useSectionClick ? onSectionClick : onClick);
  const bottomHasClick = bottomStripClickable && (useSectionClick ? onSectionClick : onClick);

  const topPending = achterw === 0 && pendingDoctorTop;
  const bottomPending = extra === 0 && pendingDoctorBottom;
  const dimTop = pendingRemoveSections?.has('top');
  const dimMiddle = pendingRemoveSections?.has('middle');
  const dimBottom = pendingRemoveSections?.has('bottom');

  return (
    <div
      className="absolute"
      data-box-type="morning"
      data-active-shift={isActive ? 'true' : undefined}
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
        zIndex: (continuesFromPrev || continuesToNext) ? 1 : undefined,
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
            className={`h-3 ${stripRoundedClass} text-[10px] text-center leading-3 text-white font-bold tracking-[0.5px] mb-1.5${topStripClickable ? ' cursor-pointer' : ''}`}
            data-doctor="111"
            data-testid="shift-block-top"
            style={{
              background: topPending ? pendingDoctorTop!.color : 'transparent',
              border: achterwDoc ? undefined : 'solid 1px #dcdcdc',
              cursor: topHasClick ? 'pointer' : undefined,
              opacity: dimTop ? 0.35 : undefined,
            }}
            onClick={topHasClick ? (e) => useSectionClick ? onSectionClick!('top', e) : onClick!(e) : undefined}
          >
            {topPending ? (pendingDoctorTop!.shortName) : null}
          </div>
        ) : (
          <div
            className={`h-3 ${stripRoundedClass} text-[10px] text-center leading-3 text-white font-bold tracking-[0.5px] mb-1.5${topStripClickable ? ' cursor-pointer' : ''}`}
            data-doctor={achterw}
            data-testid="shift-block-top"
            style={{
              background: achterwDoc?.color ?? 'transparent',
              cursor: topHasClick ? 'pointer' : undefined,
              opacity: dimTop ? 0.35 : undefined,
            }}
            onClick={topHasClick ? (e) => useSectionClick ? onSectionClick!('top', e) : onClick!(e) : undefined}
          >
            {(achterwDoc?.shortName ?? '').trim() ||
              (achterwDoc?.name ?? '').slice(0, 3).toUpperCase() ||
              `#${achterw}`}
          </div>
        ))}
      <div className="group">
        <div
          className={`flex h-[42px] mt-1 mb-1 items-center justify-between relative border border-[#a0a0a0] ${middleRoundedClass} ${doctorId ? 'active-day' : ''}`}
          data-testid="shift-block-middle"
          data-doctor={doctorId}
          data-current-date={block.currentDate}
          data-next-date={block.nextDate}
          data-date={day}
          data-month={month}
          data-year={year}
          data-morning={doctorId}
          style={{
            ...cssInline,
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
          onClick={middleHasClick ? (e) => useSectionClick ? onSectionClick!('middle', e) : onClick!(e) : undefined}
        >
          <span
            className={`rotate-180 whitespace-nowrap text-sm font-mono ${doctorId ? 'text-white' : 'text-[#a0a0a0]'}`}
            style={{ writingMode: 'vertical-rl' }}
          />
          <span className="text-white text-[10px] font-semibold tracking-[0.5px] break-words leading-[15px]">
            {showPendingDoctor ? pendingDoctor!.shortName : displayShortName}
          </span>
          <span
            className={`rotate-180 whitespace-nowrap text-sm font-mono ${doctorId ? 'text-white' : 'text-[#a0a0a0]'}`}
            style={{ writingMode: 'vertical-rl' }}
          />
        </div>
        <div
          className="hidden group-hover:flex absolute right-0 bottom-[-50%] left-1/2 -translate-x-1/2 min-w-[90px] w-max h-[45px] border-2 rounded-md list-none items-center z-10 bg-[#f7e5e6] after:content-[''] after:absolute after:left-1/2 after:top-[-8px] after:-translate-x-1/2 after:rotate-45 after:w-3 after:h-3 after:bg-[#f7e5e6] after:border-t-2 after:border-l-2 after:[border-top-color:var(--afterBorder)] after:[border-left-color:var(--afterBorder)]"
          style={{ ['--afterBorder' as string]: mainColor, borderColor: mainColor }}
        >
          <div className="flex items-center justify-between w-full px-2">
            <p className="font-bold m-0 rotate-180 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
              {block.startTime}
            </p>
            <p className="mb-0 font-bold leading-[17px] text-center">
              {doctorId ? displayName : block.label}
              {doctorId !== 0 && block.label ? (
                <span className="block text-[10px]">{block.label}</span>
              ) : null}
            </p>
            <p className="font-bold m-0 rotate-180 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
              {block.endTime}
            </p>
          </div>
        </div>
      </div>
      {!hideBottomStrip &&
        (extra === 0 ? (
          <div
            className={`h-3 ${stripRoundedClass} text-[10px] text-center leading-3 text-white font-bold tracking-[0.5px] mt-1.5${bottomStripClickable ? ' cursor-pointer' : ''}`}
            data-doctor="111"
            data-testid="shift-block-bottom"
            style={{
              background: bottomPending ? pendingDoctorBottom!.color : 'transparent',
              border: extraDoc ? undefined : 'solid 1px #dcdcdc',
              cursor: bottomHasClick ? 'pointer' : undefined,
              opacity: dimBottom ? 0.35 : undefined,
            }}
            onClick={bottomHasClick ? (e) => useSectionClick ? onSectionClick!('bottom', e) : onClick!(e) : undefined}
          >
            {bottomPending ? (pendingDoctorBottom!.shortName) : null}
          </div>
        ) : (
          <div
            className={`h-3 ${stripRoundedClass} text-[10px] text-center leading-3 text-white font-bold tracking-[0.5px] mt-1.5${bottomStripClickable ? ' cursor-pointer' : ''}`}
            data-doctor={extra}
            data-testid="shift-block-bottom"
            style={{
              background: extraDoc?.color ?? 'transparent',
              cursor: bottomHasClick ? 'pointer' : undefined,
              opacity: dimBottom ? 0.35 : undefined,
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
