/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { PlannerMonthDaypartGrid } from './PlannerMonthDaypartGrid';

describe('PlannerMonthDaypartGrid', () => {
  it('keeps leading calendar days editable and locks public-holiday dayparts', () => {
    const onCellClick = vi.fn();

    render(
      <PlannerMonthDaypartGrid
        participant={{
          id: 7,
          voornaam: 'Ada',
          voorletterstussenvoegsel: null,
          achternaam: 'Lovelace',
          initialen: 'AL',
          color: '#334155',
          name: null,
        }}
        dayparts={[
          { id: 1, naam: 'Ochtend', volgorde: 1 },
          { id: 2, naam: 'Middag', volgorde: 2 },
          { id: 3, naam: 'Avond', volgorde: 3 },
          { id: 4, naam: 'Nacht', volgorde: 4 },
        ]}
        year={2026}
        month={7}
        renderCell={() => <span>Beschikbaar</span>}
        onCellClick={onCellClick}
        blockedDates={new Set(['2026-07-14'])}
        renderBlockedCell={() => <span>Feestdag</span>}
      />
    );

    expect(screen.getAllByRole('button')).toHaveLength(140);

    fireEvent.click(screen.getByRole('button', { name: '2026-06-29 Ochtend' }));
    expect(onCellClick).toHaveBeenCalledWith(
      expect.objectContaining({
        datum: '2026-06-29',
        participant: expect.objectContaining({ id: 7 }),
        daypart: expect.objectContaining({ id: 1 }),
      })
    );

    const blockedCell = screen.getByRole('button', {
      name: '2026-07-14 Ochtend feestdag',
    });
    expect(blockedCell).toBeDisabled();
    expect(screen.getAllByText('Feestdag')).toHaveLength(4);
  });

  it('orders dayparts Ochtend, Middag, Avond, Nacht left to right even when volgorde is swapped', () => {
    const { unmount } = render(
      <PlannerMonthDaypartGrid
        participant={{
          id: 7,
          voornaam: 'Ada',
          voorletterstussenvoegsel: null,
          achternaam: 'Lovelace',
          initialen: 'AL',
          color: '#334155',
          name: null,
        }}
        dayparts={[
          { id: 1, naam: 'Ochtend', volgorde: 1 },
          { id: 2, naam: 'Middag', volgorde: 2 },
          { id: 4, naam: 'Nacht', volgorde: 3 },
          { id: 3, naam: 'Avond', volgorde: 4 },
        ]}
        year={2026}
        month={7}
        renderCell={() => null}
        onCellClick={() => undefined}
      />
    );

    const ochtend = screen.getAllByRole('button', { name: '2026-07-01 Ochtend' })[0];
    const dayCell = ochtend.parentElement;
    expect(dayCell).toBeTruthy();
    const labels = within(dayCell as HTMLElement)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(labels).toEqual([
      '2026-07-01 Ochtend',
      '2026-07-01 Middag',
      '2026-07-01 Avond',
      '2026-07-01 Nacht',
    ]);
    unmount();
  });
});
