/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { PlannerDaypartGrid } from './PlannerDaypartGrid';

// Zonder dit blijft het rooster van de vorige test in beeld staan. Dat ging tot nu toe goed
// omdat geen twee tests hetzelfde vakje opzochten, maar dat is geen eigenschap van de code.
afterEach(cleanup);

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
            voorletterstussenvoegsel: null,
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
    fireEvent.click(screen.getByRole('button', { name: 'Lovelace, Ada 2026-07-13 Ochtend' }));
    expect(onCellClick).toHaveBeenCalledWith(
      expect.objectContaining({
        datum: '2026-07-13',
        participant: expect.objectContaining({ id: 7 }),
        daypart: expect.objectContaining({ id: 1 }),
      })
    );
  });

  it('meldt een vakje dat onder de muis door komt, zodat de aanroeper kan slepen', () => {
    const onCellPointerEnter = vi.fn();
    render(
      <PlannerDaypartGrid
        weekStart="2026-07-13"
        participants={[
          {
            id: 7,
            voornaam: 'Ada',
            voorletterstussenvoegsel: null,
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
        onCellClick={() => {}}
        onCellPointerEnter={onCellPointerEnter}
        isCellUnavailable={({ daypart }) => daypart.id === 2}
      />
    );

    fireEvent.pointerEnter(
      screen.getByRole('button', { name: 'Lovelace, Ada 2026-07-13 Ochtend' }),
      { ctrlKey: true }
    );
    expect(onCellPointerEnter).toHaveBeenCalledTimes(1);
    expect(onCellPointerEnter.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        datum: '2026-07-13',
        participant: expect.objectContaining({ id: 7 }),
        daypart: expect.objectContaining({ id: 1 }),
      })
    );
    expect(onCellPointerEnter.mock.calls[0][1].ctrlKey).toBe(true);

    // Een dagdeel waarop deze deelnemer niet ingeroosterd wordt blijft buiten het slepen. Daar
    // volgt de aanwijzer die zegt dat het niet kan, en dat is het enige wat er moet gebeuren.
    fireEvent.pointerEnter(
      screen.getByRole('button', {
        name: 'Lovelace, Ada 2026-07-13 Middag niet inplanbaar',
      }),
      { ctrlKey: true }
    );
    expect(onCellPointerEnter).toHaveBeenCalledTimes(1);
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
            voorletterstussenvoegsel: null,
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
      name: 'Lovelace, Ada 2026-07-13 Middag niet inplanbaar',
    });
    expect(unavailable).not.toBeDisabled();
    fireEvent.click(unavailable);
    expect(onCellClick).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith(
      'Dit dagdeel is niet beschikbaar voor deze deelnemer/waarneemgroep'
    );
    toastInfo.mockRestore();
  });

  it('toont een gevuld niet-inplanbaar vakje en laat het aanklikken als de vlag aanstaat', () => {
    const onCellClick = vi.fn();
    render(
      <PlannerDaypartGrid
        weekStart="2026-07-13"
        toonInhoudOpNietInplanbaar
        participants={[
          {
            id: 7,
            voornaam: 'Ada',
            voorletterstussenvoegsel: null,
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
        renderCell={({ daypart }) => (daypart.id === 2 ? <span>Compensatie</span> : null)}
        onCellClick={onCellClick}
        isCellUnavailable={({ daypart }) => daypart.id === 2}
        isCellFilled={({ daypart }) => daypart.id === 2}
      />
    );

    const verstopt = screen.getAllByRole('button', {
      name: 'Lovelace, Ada 2026-07-13 Middag niet inplanbaar, klik om weg te halen',
    })[0];
    expect(screen.getAllByText('Compensatie').length).toBeGreaterThan(0);
    fireEvent.click(verstopt);
    expect(onCellClick).toHaveBeenCalledWith(
      expect.objectContaining({ datum: '2026-07-13', daypart: expect.objectContaining({ id: 2 }) })
    );
  });

  it('makes participant names clickable when onParticipantNameClick is provided', () => {
    const onParticipantNameClick = vi.fn();
    render(
      <PlannerDaypartGrid
        weekStart="2026-07-13"
        participants={[
          {
            id: 7,
            voornaam: 'Ada',
            voorletterstussenvoegsel: null,
            achternaam: 'Lovelace',
            initialen: 'AL',
            color: '#334155',
            name: null,
          },
        ]}
        dayparts={[{ id: 1, naam: 'Ochtend', volgorde: 1 }]}
        renderCell={() => null}
        onParticipantNameClick={onParticipantNameClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lovelace, Ada' }));
    expect(onParticipantNameClick).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });

  it('lists assigned expertises under the participant name', () => {
    render(
      <PlannerDaypartGrid
        weekStart="2026-07-13"
        participants={[
          {
            id: 7,
            voornaam: 'Ada',
            voorletterstussenvoegsel: null,
            achternaam: 'Lovelace',
            initialen: 'AL',
            color: '#334155',
            name: null,
            expertises: [
              { id: 1, naam: 'Spoedzorg', afkorting: 'SZ' },
              { id: 2, naam: 'Visite', afkorting: null },
            ],
          },
        ]}
        dayparts={[{ id: 1, naam: 'Ochtend', volgorde: 1 }]}
        renderCell={() => null}
      />
    );

    const expertises = screen.getByText('SZ, Visite');
    expect(expertises).toBeInTheDocument();
    expect(expertises).toHaveAttribute('title', 'Spoedzorg, Visite');
  });
});
