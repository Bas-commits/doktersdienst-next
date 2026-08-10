'use client';

import { Ban } from 'lucide-react';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { PlannerIconImage } from './PlannerIconImage';

export type PlannerCursorTool = {
  icon: string | ReactNode | null;
  color: string | null;
  background?: string | null;
  label: string;
  preview?: ReactNode;
};

/** Gray not-allowed icon shown next to the cursor on unavailable daypart cells. */
export const UNAVAILABLE_DAYPART_CURSOR_TOOL: PlannerCursorTool = {
  icon: null,
  color: null,
  label: 'Niet beschikbaar',
  preview: (
    <Ban className="size-6 text-slate-400 drop-shadow-sm" strokeWidth={2.25} aria-hidden />
  ),
};

export function usePlannerCursorTool({
  active,
  containerRef,
  onDismiss,
  keepActiveSelector = '[data-planner-tool-keep-active]',
}: {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onDismiss?: () => void;
  keepActiveSelector?: string;
}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isActive = active && onDismiss != null;

  useEffect(() => {
    if (!isActive || !onDismiss) return;

    const handleMove = (event: MouseEvent) => {
      setPosition({ x: event.clientX, y: event.clientY });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onDismiss();
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(keepActiveSelector)) return;
      onDismiss();
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [containerRef, isActive, keepActiveSelector, onDismiss]);

  return isActive ? position : null;
}

export function PlannerCursorToolFollower({
  tool,
  position,
}: {
  tool: PlannerCursorTool | null;
  position: { x: number; y: number } | null;
}) {
  if (!tool || !position || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={[
        'pointer-events-none fixed z-[100]',
        tool.preview ? '' : 'flex size-9 items-center justify-center rounded shadow-lg ring-2 ring-white/80',
      ].join(' ')}
      style={{
        left: position.x + 12,
        top: position.y + 12,
        background: tool.preview ? undefined : tool.background ?? tool.color ?? '#64748b',
      }}
      aria-hidden
    >
      {tool.preview ?? (tool.icon ? (
        typeof tool.icon === 'string' ? (
          <PlannerIconImage
            src={tool.icon}
            width={24}
            height={24}
            className="size-6 object-contain"
            fallback={<span className="px-1 text-[10px] font-bold text-white">{tool.label.slice(0, 2)}</span>}
          />
        ) : (
          <span className="size-6 [&_svg]:size-full">{tool.icon}</span>
        )
      ) : (
        <span className="px-1 text-[10px] font-bold text-white">{tool.label.slice(0, 2)}</span>
      ))}
    </div>,
    document.body
  );
}
