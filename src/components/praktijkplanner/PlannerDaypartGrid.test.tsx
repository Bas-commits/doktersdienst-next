/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { PlannerDaypartGrid } from './PlannerDaypartGrid';

describe('PlannerDaypartGrid', () => {
  it('renders daypart cells and reports a selected slot', () => {
    const onCellClick = vi.fn();
    render(
      <PlannerDaypartGrid
        weekStart="2026-07-13"
        participants={[
          {
            id: 7,
            voornaam: 'Ada',
            achternaam: 'Lovelace',
            initialen: 'AL',
            color: '#334155',
            name: null,
          },
        ]}
        dayparts={[
          { id: 1, naam: 'Ochtend', volgorde: 1 },
          { id: 2, naam: 'Middag', volgorde: 2 },
        ]}
        renderCell={() => <span>Beschikbaar</span>}
        onCellClick={onCellClick}
        holidayLabels={new Map([['2026-07-13', ['Feestdag']]])}
      />
    );

    expect(screen.getByText('Feestdag')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ada Lovelace 2026-07-13 Ochtend' }));
    expect(onCellClick).toHaveBeenCalledWith(
      expect.objectContaining({
        datum: '2026-07-13',
        participant: expect.objectContaining({ id: 7 }),
        daypart: expect.objectContaining({ id: 1 }),
      })
    );
  });
});
