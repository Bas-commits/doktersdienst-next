/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlannerCombinedDaypartChip } from './PlannerCombinedDaypartChip';

describe('PlannerCombinedDaypartChip', () => {
  it('renders tasks, activity, and location in their assigned rows', () => {
    render(
      <PlannerCombinedDaypartChip
        tasks={[{ id: 1, label: 'SV', color: '#800080' }]}
        activity={{ id: 2, label: 'ALG · SP', color: '#008000' }}
        location={{ id: 3, label: 'UT', color: '#fb7185' }}
      />
    );

    const chip = screen.getByLabelText('SV · ALG · SP · UT');
    const rows = Array.from(chip.querySelectorAll('[data-planner-daypart-chip-row]'));

    expect(rows.map((row) => row.textContent)).toEqual(['SV', 'ALG · SP', 'UT']);
    expect(rows.map((row) => row.getAttribute('data-planner-daypart-chip-row'))).toEqual([
      'tasks',
      'activity',
      'location',
    ]);
  });

  it('keeps unselected rows visible as empty placeholders', () => {
    render(<PlannerCombinedDaypartChip activity={{ id: 2, label: 'ALG', color: '#008000' }} />);

    const chip = screen.getByLabelText('ALG');
    const rows = Array.from(chip.querySelectorAll('[data-planner-daypart-chip-row]'));

    expect(rows.map((row) => row.textContent)).toEqual(['', 'ALG', '']);
  });

  it('uses a contrasting monochrome activity icon', () => {
    const { container } = render(
      <>
        <PlannerCombinedDaypartChip
          activity={{ id: 1, label: 'Donker', color: '#1e3a5f', icon: '/icons/activity.svg' }}
        />
        <PlannerCombinedDaypartChip
          activity={{ id: 2, label: 'Licht', color: '#ffeb3b', icon: '/icons/activity.svg' }}
        />
      </>
    );

    const icons = container.querySelectorAll('img');
    expect(icons[0]).toHaveStyle({ filter: 'brightness(0) invert(1)' });
    expect(icons[1]).toHaveStyle({ filter: 'brightness(0)' });
  });
});
