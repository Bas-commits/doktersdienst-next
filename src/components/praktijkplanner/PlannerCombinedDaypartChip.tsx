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

function ChipRow({ row, items }: ChipRowProps) {
  if (items.length === 0) {
    return (
      <span
        className="flex min-h-0 flex-1 items-center justify-center bg-neutral-300"
        data-planner-daypart-chip-row={row}
      />
    );
  }

  return (
    <span
      className="flex min-h-0 flex-1 overflow-hidden"
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
}: {
  tasks?: PlannerDaypartChipItem[];
  activity?: PlannerDaypartChipItem | null;
  location?: PlannerDaypartChipItem | null;
  className?: string;
  fill?: boolean;
}) {
  const label = [...tasks.map((task) => task.label), activity?.label, location?.label]
    .filter(Boolean)
    .join(' · ');

  return (
    <span
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-md border border-black/10 text-center shadow-sm',
        fill ? 'h-full w-full min-h-0' : 'h-12',
        className
      )}
      aria-label={label || undefined}
      title={label || undefined}
    >
      <ChipRow row="tasks" items={tasks} />
      <ChipRow row="activity" items={activity ? [activity] : []} />
      <ChipRow row="location" items={location ? [location] : []} />
    </span>
  );
}
