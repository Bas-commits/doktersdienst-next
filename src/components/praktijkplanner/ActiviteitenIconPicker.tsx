'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fallbackIconPath } from '@/components/praktijkplanner/absence-icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  activiteitenIconLabel,
  activiteitenIconPath,
} from '@/lib/praktijkplanner/activiteiten-iconen';

function displayIconPath(value: string): string | null {
  return activiteitenIconPath(value) ?? fallbackIconPath(value);
}

function IconPreview({ filename, size = 24 }: { filename: string; size?: number }) {
  const src = displayIconPath(filename);
  if (!src) return null;

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className="size-6 shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export function ActiviteitenIconPicker({
  groupId,
  value,
  onChange,
}: {
  groupId: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [icons, setIcons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();
    setLoading(true);
    fetch(`/api/praktijkplanner/activiteiten-iconen?idwaarneemgroep=${groupId}`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { icons?: string[]; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Iconen konden niet worden geladen.');
        return payload.icons ?? [];
      })
      .then((nextIcons) => {
        if (!abortController.signal.aborted) setIcons(nextIcons);
      })
      .catch(() => {
        if (!abortController.signal.aborted) setIcons([]);
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false);
      });

    return () => abortController.abort();
  }, [groupId]);

  const selectedLabel = useMemo(() => {
    if (!value) return 'Kies een icoon';
    return activiteitenIconLabel(value);
  }, [value]);

  const selectIcon = (filename: string) => {
    onChange(filename);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className="flex h-9 w-full items-center justify-between gap-2 rounded border border-input bg-background px-2 text-left text-sm hover:bg-muted/40"
      >
        <span className="flex min-w-0 items-center gap-2">
          {value ? <IconPreview filename={value} /> : null}
          <span className="truncate">{selectedLabel}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        {loading ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">Iconen laden…</p>
        ) : icons.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">Geen iconen gevonden.</p>
        ) : (
          <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
            <button
              type="button"
              onClick={() => selectIcon('')}
              className={[
                'flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs hover:bg-muted',
                !value ? 'border-primary ring-1 ring-primary/30' : 'border-border',
              ].join(' ')}
            >
              <span className="flex size-8 items-center justify-center text-[10px] text-muted-foreground">—</span>
              <span className="text-center leading-tight">Geen icoon</span>
            </button>
            {icons.map((filename) => {
              const selected = value === filename;
              return (
                <button
                  key={filename}
                  type="button"
                  onClick={() => selectIcon(filename)}
                  className={[
                    'flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs hover:bg-muted',
                    selected ? 'border-primary ring-1 ring-primary/30' : 'border-border',
                  ].join(' ')}
                >
                  <span className="flex size-8 items-center justify-center">
                    <IconPreview filename={filename} size={32} />
                  </span>
                  <span className="text-center leading-tight">{activiteitenIconLabel(filename)}</span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
