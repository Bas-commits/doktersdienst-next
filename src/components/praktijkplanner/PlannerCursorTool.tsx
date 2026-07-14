'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

export type PlannerCursorTool = {
  icon: string | ReactNode | null;
  color: string | null;
  background?: string | null;
  label: string;
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

  useEffect(() => {
    if (!active || !onDismiss) {
      setPosition(null);
      return;
    }

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
  }, [active, containerRef, keepActiveSelector, onDismiss]);

  return position;
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
      className="pointer-events-none fixed z-[100] flex size-9 items-center justify-center rounded shadow-lg ring-2 ring-white/80"
      style={{
        left: position.x + 12,
        top: position.y + 12,
        background: tool.background ?? tool.color ?? '#64748b',
      }}
      aria-hidden
    >
      {tool.icon ? (
        typeof tool.icon === 'string' ? (
          <Image src={tool.icon} alt="" width={24} height={24} className="size-6 object-contain" />
        ) : (
          <span className="size-6 [&_svg]:size-full">{tool.icon}</span>
        )
      ) : (
        <span className="px-1 text-[10px] font-bold text-white">{tool.label.slice(0, 2)}</span>
      )}
    </div>,
    document.body
  );
}
