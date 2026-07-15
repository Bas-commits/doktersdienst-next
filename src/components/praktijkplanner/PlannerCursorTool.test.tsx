/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PlannerCursorToolFollower,
  usePlannerCursorTool,
  type PlannerCursorTool,
} from './PlannerCursorTool';
import { PlannerCombinedDaypartChip } from './PlannerCombinedDaypartChip';

afterEach(cleanup);

function CursorHarness({
  tool,
  onDismiss,
}: {
  tool: PlannerCursorTool;
  onDismiss: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const position = usePlannerCursorTool({
    active: true,
    containerRef,
    onDismiss,
  });

  return (
    <>
      <div ref={containerRef} data-testid="planner-grid">
        Planner
      </div>
      <button type="button" data-testid="planner-toolbar" data-planner-tool-keep-active>
        Toolbar
      </button>
      <PlannerCursorToolFollower tool={tool} position={position} />
    </>
  );
}

describe('PlannerCursorTool', () => {
  it('renders a combined preview at the cursor position', () => {
    const onDismiss = vi.fn();
    render(
      <CursorHarness
        onDismiss={onDismiss}
        tool={{
          icon: null,
          color: null,
          label: 'SV · ALG · UT',
          preview: (
            <PlannerCombinedDaypartChip
              tasks={[{ id: 1, label: 'SV', color: '#800080' }]}
              activity={{ id: 2, label: 'ALG', color: '#008000' }}
              location={{ id: 3, label: 'UT', color: '#fb7185' }}
            />
          ),
        }}
      />
    );

    fireEvent.mouseMove(window, { clientX: 30, clientY: 40 });

    const preview = screen.getByLabelText('SV · ALG · UT');
    expect(preview.parentElement).toHaveStyle({ left: '42px', top: '52px' });
  });

  it('keeps the tool active for planner controls and dismisses it outside the planner', () => {
    const onDismiss = vi.fn();
    render(
      <CursorHarness
        onDismiss={onDismiss}
        tool={{ icon: null, color: '#64748b', label: 'ALG' }}
      />
    );

    fireEvent.pointerDown(screen.getByTestId('planner-grid'));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.pointerDown(screen.getByTestId('planner-toolbar'));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
