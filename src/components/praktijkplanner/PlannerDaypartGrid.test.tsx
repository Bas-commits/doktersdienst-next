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

  it('grays out unavailable dayparts and shows a toast on click', async () => {
    const onCellClick = vi.fn();
    const { toast } = await import('sonner');
    const toastInfo = vi.spyOn(toast, 'info').mockImplementation(() => '');

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
        isCellUnavailable={({ datum, daypart }) => datum === '2026-07-13' && daypart.id === 2}
        isCellFilled={() => true}
      />
    );

    const unavailable = screen.getByRole('button', {
      name: 'Ada Lovelace 2026-07-13 Middag niet inplanbaar',
    });
    expect(unavailable).not.toBeDisabled();
    fireEvent.click(unavailable);
    expect(onCellClick).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith(
      'Dit dagdeel is niet beschikbaar voor deze deelnemer/waarneemgroep'
    );
    toastInfo.mockRestore();
  });
});
