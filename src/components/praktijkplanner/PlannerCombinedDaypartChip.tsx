'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { getContrastTextColor } from '@/utils/contrastTextColor';

export type PlannerDaypartChipItem = {
  id?: number | string;
  label: string;
  color: string | null;
  icon?: string | null;
};

type ChipRowProps = {
  row: 'tasks' | 'activity' | 'location';
  items: PlannerDaypartChipItem[];
  participantColor?: string | null;
};

function rowBorderClasses(row: ChipRowProps['row'], participantColor?: string | null): string {
  if (participantColor) {
    if (row === 'tasks') return 'border-x-[3px] border-t-[3px] border-b-0 rounded-t-md';
    if (row === 'location') return 'border-x-[3px] border-b-[3px] border-t-0 rounded-b-md';
    return 'border-x-[3px] border-y-0';
  }

  if (row === 'tasks') return 'rounded-t-md border border-b-0 border-black/10';
  if (row === 'location') return 'rounded-b-md border border-t-0 border-black/10';
  return 'border-x border-y-0 border-black/10';
}

function rowBorderStyle(participantColor?: string | null): CSSProperties | undefined {
  return participantColor ? { borderColor: participantColor } : undefined;
}

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

function emptyRowRounding(row: ChipRowProps['row']): string {
  if (row === 'tasks') return 'rounded-t-md';
  if (row === 'location') return 'rounded-b-md';
  return 'rounded-none';
}

function ChipRow({ row, items, participantColor }: ChipRowProps) {
  const rowBorderClassName = rowBorderClasses(row, participantColor);
  const rowBorderStyleValue = rowBorderStyle(participantColor);

  if (items.length === 0) {
    return (
      <span
        className={cn(
          'box-border flex min-h-0 flex-1 items-center justify-center bg-neutral-300',
          emptyRowRounding(row),
          rowBorderClassName
        )}
        style={rowBorderStyleValue}
        data-planner-daypart-chip-row={row}
      />
    );
  }

  return (
    <span
      className={cn('box-border flex min-h-0 flex-1 overflow-hidden', rowBorderClassName)}
      style={rowBorderStyleValue}
      data-planner-daypart-chip-row={row}
    >
      {items.map((item, index) => (
        <span
          key={item.id ?? `${item.label}-${index}`}
          className="flex min-w-0 flex-1 items-center justify-center gap-0.5 px-1"
          style={itemStyle(item.color)}
          title={item.label}
        >
          {item.icon ? (
            <Image
              src={item.icon}
              alt=""
              width={12}
              height={12}
              className="size-3 shrink-0 object-contain"
              style={iconStyle(item.color)}
            />
          ) : null}
          <span className="truncate text-[9px] font-semibold leading-tight">{item.label}</span>
        </span>
      ))}
    </span>
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
}: {
  tasks?: PlannerDaypartChipItem[];
  activity?: PlannerDaypartChipItem | null;
  location?: PlannerDaypartChipItem | null;
  className?: string;
  fill?: boolean;
  participantColor?: string | null;
  initials?: string | null;
}) {
  const label = [...tasks.map((task) => task.label), activity?.label, location?.label]
    .filter(Boolean)
    .join(' · ');

  return (
    <span
      className={cn(
        'relative flex min-w-0 flex-col overflow-visible rounded-md text-center shadow-sm',
        fill ? 'h-full w-full min-h-0' : 'h-12',
        className
      )}
      aria-label={label || undefined}
      title={label || undefined}
    >
      <span className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md">
        <ChipRow row="tasks" items={tasks} participantColor={participantColor} />
        <ChipRow row="activity" items={activity ? [activity] : []} participantColor={participantColor} />
        <ChipRow row="location" items={location ? [location] : []} participantColor={participantColor} />
      </span>
      {participantColor ? (
        <span
          aria-hidden
          className="absolute bottom-0 left-1/2 z-20 flex h-2 w-1/2 -translate-x-1/2 translate-y-1/2 items-center justify-center truncate rounded-full px-0.5 text-[7px] font-bold leading-none"
          style={{
            backgroundColor: participantColor,
            color: getContrastTextColor(participantColor),
          }}
        >
          {initials?.slice(0, 4).toUpperCase()}
        </span>
      ) : null}
    </span>
  );
}
