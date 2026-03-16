'use client';

import { Briefcase, Check, GraduationCap, Trash2, TreePalm, X } from 'lucide-react';
import type { ChipDefinition } from '@/types/voorkeuren';
import { CHIP_DEFINITIONS } from '@/types/voorkeuren';

const WEGHALEN_CODE = '1014';

/** Same filled style as ShiftBlock: background color + Lucide icon per preference code. Exported for cursor preview. */
export const CHIP_STYLE: Record<
  string,
  { backgroundColor: string; Icon: typeof Check; iconColor: string }
> = {
  '3': { backgroundColor: '#22c55e', Icon: Check, iconColor: 'white' },
  '2': { backgroundColor: '#eab308', Icon: X, iconColor: 'white' },
  '9': { backgroundColor: '#ef4444', Icon: TreePalm, iconColor: 'white' },
  '10': { backgroundColor: '#a855f7', Icon: GraduationCap, iconColor: 'white' },
  '1014': { backgroundColor: '#94a3b8', Icon: Trash2, iconColor: 'white' },
  '5001': { backgroundColor: '#64748b', Icon: Briefcase, iconColor: 'white' },
};

export interface ChipSelectorProps {
  selectedChipCode: string | null;
  onSelectChip: (code: string | null) => void;
}

export function ChipSelector({ selectedChipCode, onSelectChip }: ChipSelectorProps) {
  function handleClick(chip: ChipDefinition) {
    onSelectChip(selectedChipCode === chip.code ? null : chip.code);
  }

  return (
    <div className="flex flex-col gap-2">
      {CHIP_DEFINITIONS.map((chip) => {
        const isSelected = selectedChipCode === chip.code;
        const style = CHIP_STYLE[chip.code];
        const IconComponent = style?.Icon;
        return (
          <div key={chip.code} className="flex items-center gap-3">
            <button
              type="button"
              aria-label={chip.label}
              aria-pressed={isSelected}
              data-testid={`chip-${chip.code}`}
              onClick={() => handleClick(chip)}
              className={`
                flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 transition-colors
                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                ${style
                  ? ''
                  : isSelected
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                    : 'border-muted-foreground/30 bg-muted/50 hover:border-muted-foreground/60 hover:bg-muted'
                }
              `}
              style={
                style
                  ? {
                      backgroundColor: style.backgroundColor,
                      borderColor: isSelected ? 'var(--primary)' : 'rgba(0,0,0,0.2)',
                      ...(isSelected ? { boxShadow: '0 0 0 2px var(--primary)' } : {}),
                    }
                  : undefined
              }
            >
              {IconComponent ? (
                <IconComponent
                  className="h-4 w-4 shrink-0"
                  style={style ? { color: style.iconColor } : undefined}
                  aria-hidden
                />
              ) : null}
            </button>
            <span className="text-sm font-medium text-foreground">{chip.label}</span>
          </div>
        );
      })}
    </div>
  );
}
