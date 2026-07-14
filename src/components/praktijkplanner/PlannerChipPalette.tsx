'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

export type PlannerPaletteItem = {
  id: number | string;
  label: string;
  color?: string | null;
  background?: string | null;
  detail?: string | null;
  icon?: string | ReactNode | null;
};

function chipButtonClass(selected: boolean, isSidebar: boolean) {
  return [
    'rounded-md border text-left text-xs font-medium transition',
    isSidebar
      ? 'flex w-full items-center gap-2 px-2 py-1.5'
      : 'inline-flex flex-col items-start gap-0.5 px-2.5 py-1.5',
    selected ? 'border-2 text-white ring-2 ring-white/50' : 'border-transparent text-foreground hover:bg-muted/60',
  ].join(' ');
}

function colorBackgroundStyle(color?: string | null, background?: string | null) {
  if (!color && !background) return undefined;
  return { background: background ?? color ?? undefined };
}

function iconWrapperClass(isSidebar: boolean) {
  return isSidebar
    ? 'flex h-8 shrink-0 items-center justify-center overflow-hidden rounded-md px-2.5'
    : 'flex h-5 shrink-0 items-center justify-center overflow-hidden rounded-md px-1.5';
}

function renderItemIcon(icon: string | ReactNode, isSidebar: boolean) {
  const sizeClass = isSidebar ? 'size-8' : 'size-5';
  if (typeof icon === 'string') {
    return (
      <Image
        src={icon}
        alt=""
        width={isSidebar ? 32 : 20}
        height={isSidebar ? 32 : 20}
        className={`${sizeClass} object-contain`}
      />
    );
  }
  return <span className={`${sizeClass} [&_svg]:size-full`}>{icon}</span>;
}

function chipButtonStyle(selected: boolean, color?: string | null, background?: string | null) {
  if (!selected) return undefined;
  return {
    borderColor: color ?? undefined,
    ...colorBackgroundStyle(color, background),
  };
}

export function PlannerChipPalette({
  title,
  items,
  selectedId,
  onSelect,
  onClear,
  emptyMessage = 'Geen opties beschikbaar.',
  variant = 'wrap',
}: {
  title: string;
  items: PlannerPaletteItem[];
  selectedId: number | string | null;
  onSelect: (id: number | string) => void;
  onClear?: () => void;
  emptyMessage?: string;
  variant?: 'wrap' | 'sidebar';
}) {
  const isSidebar = variant === 'sidebar';

  return (
    <section className="w-fit max-w-[11rem] rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className={isSidebar ? 'mb-3' : 'mb-2 flex items-center justify-between gap-2'}>
        <h2 className="text-sm font-semibold leading-snug">{title}</h2>
        {onClear ? (
          <button
            type="button"
            className={[
              'text-xs font-medium text-muted-foreground hover:text-foreground',
              isSidebar ? 'mt-1 block text-left' : '',
            ].join(' ')}
            onClick={onClear}
          >
            Wis selectie
          </button>
        ) : null}
      </div>
      <div className={isSidebar ? 'flex w-full flex-col gap-2' : 'flex flex-wrap gap-2'}>
        {items.map((item) => {
          const selected = selectedId === item.id;
          const hasColor = Boolean(item.color || item.background);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={chipButtonClass(selected, isSidebar)}
              style={chipButtonStyle(selected, item.color, item.background)}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {item.icon ? (
                  <span
                    className={[
                      iconWrapperClass(isSidebar),
                      hasColor && !selected ? 'text-white' : '',
                    ].join(' ')}
                    style={!selected && hasColor ? colorBackgroundStyle(item.color, item.background) : undefined}
                  >
                    {renderItemIcon(item.icon, isSidebar)}
                  </span>
                ) : null}
                <span className="min-w-0 leading-snug">{item.label}</span>
              </span>
              {item.detail && !isSidebar ? (
                <span className="font-normal opacity-80">{item.detail}</span>
              ) : null}
            </button>
          );
        })}
        {items.length === 0 ? <p className="text-xs text-muted-foreground">{emptyMessage}</p> : null}
      </div>
    </section>
  );
}
