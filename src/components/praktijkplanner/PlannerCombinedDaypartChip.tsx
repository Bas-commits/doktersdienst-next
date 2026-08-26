'use client';

import Image from 'next/image';
import { Phone } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { getContrastTextColor } from '@/utils/contrastTextColor';

export type PlannerDaypartChipItem = {
  id?: number | string;
  label: string;
  color: string | null;
  icon?: string | null;
  /**
   * Collega's mogen deze taak bellen. Levert een telefoonicoontje in de band op.
   *
   * Het nummer staat er niet bij en het icoontje doet niets bij aanklikken. Het zegt alleen dat
   * er iemand bereikbaar is, want wie belt kijkt eerst wie er zit en pakt daarna zijn telefoon.
   */
  inbelbaar?: boolean;
};

/**
 * Hoe groot het fiche getekend wordt.
 *
 * `micro` is de maandweergave: een vakje van ongeveer 34 pixels, dus een band van elf. Daar
 * past geen tekst in die iemand nog kan lezen, en een afgekapt woord van twee letters is
 * erger dan geen woord. Wat overblijft is wat je in een maand ook echt afleest: de kleuren
 * van de drie banden, het kader in de kleur van de deelnemer en het icoon van de activiteit.
 * De hoverkaart toont onveranderd de hele fiche met alle namen.
 */
type ChipDensity = 'micro' | 'compact' | 'popover';

type ChipBandProps = {
  row: 'tasks' | 'activity' | 'location';
  items: PlannerDaypartChipItem[];
  style: CSSProperties;
  density: ChipDensity;
};

function itemStyle(color: string | null): CSSProperties {
  const backgroundColor = color || '#64748b';
  return {
    backgroundColor,
    color: getContrastTextColor(backgroundColor),
  };
}

function iconStyle(color: string | null): CSSProperties {
  const backgroundColor = color || '#64748b';
  return {
    filter:
      getContrastTextColor(backgroundColor) === '#ffffff'
        ? 'brightness(0) invert(1)'
        : 'brightness(0)',
  };
}

/**
 * One horizontal band of the chip. Positioned by the parent so bands overlap by 1px;
 * that overlap (not flex) is what prevents white hairlines between rows.
 */
function ChipBand({ row, items, style, density }: ChipBandProps) {
  const isPopover = density === 'popover';
  const toontTekst = density !== 'micro';

  if (items.length === 0) {
    return (
      <span
        className="absolute inset-x-0 flex items-center justify-center bg-neutral-300"
        style={style}
        data-planner-daypart-chip-row={row}
      />
    );
  }

  // Band fill matches the first segment so any micro-gap between segments is never white.
  const bandFill = items[0]?.color || '#64748b';

  return (
    <span
      className="absolute inset-x-0 flex"
      style={{ ...style, backgroundColor: bandFill }}
      data-planner-daypart-chip-row={row}
    >
      {items.map((item, index) => (
        <span
          key={item.id ?? `${item.label}-${index}`}
          className={cn(
            'flex h-full min-w-0 flex-1 items-center justify-center',
            isPopover ? 'gap-1 px-1.5' : toontTekst ? 'gap-0.5 px-1' : 'px-0',
            // Overlap adjacent task segments the same way bands overlap.
            index < items.length - 1 && '-mr-px'
          )}
          style={itemStyle(item.color)}
        >
          {item.icon ? (
            <Image
              src={item.icon}
              alt=""
              width={64}
              height={64}
              // Scale to band height so the icon fills the row (grid + popover).
              className="h-[85%] w-auto shrink-0 object-contain"
              style={iconStyle(item.color)}
            />
          ) : null}
          {toontTekst ? (
            <span
              className={cn(
                'truncate font-semibold leading-tight',
                isPopover ? 'text-[13px]' : 'text-[9px]'
              )}
            >
              {item.label}
            </span>
          ) : null}
          {/*
            Alleen waar tekst past. In de maandweergave is de band elf pixels hoog; een tweede
            pictogram naast dat van de activiteit is daar een vlekje en geen mededeling.
          */}
          {item.inbelbaar && toontTekst ? (
            <Phone
              aria-label="Hierop kan worden ingebeld"
              className={cn('shrink-0', isPopover ? 'size-3.5' : 'size-2.5')}
              strokeWidth={2.5}
            />
          ) : null}
        </span>
      ))}
    </span>
  );
}

function fallbackFaceColor(
  participantColor: string | null | undefined,
  tasks: PlannerDaypartChipItem[],
  activity: PlannerDaypartChipItem | null | undefined,
  location: PlannerDaypartChipItem | null | undefined
): string {
  // Any residual seam must match a chip color, never page white.
  return (
    participantColor ||
    location?.color ||
    activity?.color ||
    tasks[0]?.color ||
    '#a3a3a3'
  );
}

export function PlannerCombinedDaypartChip({
  tasks = [],
  activity,
  location,
  className = '',
  fill = false,
  participantColor,
  initials,
  density = 'compact',
}: {
  tasks?: PlannerDaypartChipItem[];
  activity?: PlannerDaypartChipItem | null;
  location?: PlannerDaypartChipItem | null;
  className?: string;
  fill?: boolean;
  participantColor?: string | null;
  initials?: string | null;
  /** `popover`: larger labels/icons, initials sit below the face. `micro`: zie ChipDensity. */
  density?: ChipDensity;
}) {
  const label = [...tasks.map((task) => task.label), activity?.label, location?.label]
    .filter(Boolean)
    .join(' · ');
  const hasParticipantBorder = Boolean(participantColor);
  const faceColor = fallbackFaceColor(participantColor, tasks, activity, location);

  // Real outer border without CSS `border`: the frame is colored padding around a
  // clipped face. Gaps can only show the frame color, never page white.
  // Use a solid default frame (not rgba) so small builder previews never fringe white.
  const borderWidthClass = hasParticipantBorder ? 'p-[3px]' : 'p-px';
  const borderColor = hasParticipantBorder ? participantColor! : '#c4c4c4';

  return (
    <span
      className={cn(
        'relative block min-w-0 text-center shadow-sm',
        fill ? 'h-full w-full min-h-0' : 'h-12',
        density === 'popover' && 'mb-3',
        className
      )}
      aria-label={label || undefined}
      data-participant-border={hasParticipantBorder ? 'true' : undefined}
    >
      <span
        className={cn('absolute inset-0 rounded-md', borderWidthClass)}
        style={{ backgroundColor: borderColor }}
        data-planner-daypart-chip-border=""
      >
        <span
          className={cn(
            'relative block h-full w-full overflow-hidden',
            // Keep corner concentric with the outer radius (6px) minus padding.
            hasParticipantBorder ? 'rounded-[3px]' : 'rounded-[5px]'
          )}
          style={{ backgroundColor: faceColor }}
          data-planner-daypart-chip-face=""
        >
          {/*
            Absolute bands with 1px vertical overlap. Flex 1fr/1fr/1fr was the source of
            intermittent white seams between activity and location.
          */}
          <ChipBand
            row="tasks"
            items={tasks}
            density={density}
            style={{ top: 0, height: 'calc(33.333% + 1px)' }}
          />
          <ChipBand
            row="activity"
            items={activity ? [activity] : []}
            density={density}
            style={{ top: 'calc(33.333% - 1px)', height: 'calc(33.333% + 2px)' }}
          />
          <ChipBand
            row="location"
            items={location ? [location] : []}
            density={density}
            style={{ top: 'calc(66.666% - 1px)', bottom: 0 }}
          />
        </span>
      </span>

      {/*
        In de maandweergave staat de naam al aan het begin van de rij en hangt het bolletje
        half buiten het fiche, dus over de rij eronder. Daar zegt het niets en dekt het wel af.
      */}
      {participantColor && initials && density !== 'micro' ? (
        <span
          aria-hidden
          className={cn(
            'absolute left-1/2 z-20 flex -translate-x-1/2 items-center justify-center truncate rounded-full px-1 font-bold leading-none',
            density === 'popover'
              ? // Fully below the face; only the top half of the badge kisses the border.
                'top-full h-4 w-[60%] -translate-y-1/3 text-[11px]'
              : 'bottom-0 h-2 w-1/2 translate-y-1/2 text-[7px]'
          )}
          style={{
            backgroundColor: participantColor,
            color: getContrastTextColor(participantColor),
          }}
        >
          {initials.slice(0, 4).toUpperCase()}
        </span>
      ) : null}
    </span>
  );
}
