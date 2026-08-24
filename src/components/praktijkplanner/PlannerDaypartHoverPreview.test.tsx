/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlannerDaypartHoverPreview } from './PlannerDaypartHoverPreview';

afterEach(cleanup);

function openHover(): void {
  fireEvent.mouseEnter(screen.getByText('fiche'), { clientX: 100, clientY: 100 });
}

const basis = {
  enabled: true,
  participantName: 'Veltenaar, Bart, B',
  initials: 'JBHV',
  datum: '2026-08-04',
  daypartName: 'Nacht',
  fromRepetition: false,
  isException: false,
  chip: <span>chip</span>,
};

describe('PlannerDaypartHoverPreview', () => {
  it('noemt bij een aanvraag welk type absentie is aangevraagd', async () => {
    render(
      <PlannerDaypartHoverPreview
        {...basis}
        absence={{ type: 'Nascholing', aangevraagd: true }}
      >
        <span>fiche</span>
      </PlannerDaypartHoverPreview>
    );

    openHover();

    const blok = await waitFor(() => screen.getByTestId('hover-absentie'));
    expect(blok).toHaveTextContent('Absentie aangevraagd: Nascholing. Nog niet goedgekeurd.');
    expect(blok).toHaveTextContent('?');
  });

  it('zet geen vraagteken bij een goedgekeurde absentie', async () => {
    render(
      <PlannerDaypartHoverPreview {...basis} absence={{ type: 'Vakantie', aangevraagd: false }}>
        <span>fiche</span>
      </PlannerDaypartHoverPreview>
    );

    openHover();

    const blok = await waitFor(() => screen.getByTestId('hover-absentie'));
    expect(blok).toHaveTextContent('Absentie: Vakantie. Goedgekeurd.');
    expect(blok).not.toHaveTextContent('?');
  });

  it('laat activiteit, locatie, herhaling en taken weg op een dagdeel zonder planning', async () => {
    render(
      <PlannerDaypartHoverPreview
        {...basis}
        absence={{ type: 'Vakantie', aangevraagd: true }}
        showPlanningDetails={false}
      >
        <span>fiche</span>
      </PlannerDaypartHoverPreview>
    );

    openHover();

    await waitFor(() => screen.getByTestId('hover-absentie'));
    expect(screen.queryByText('Activiteit')).toBeNull();
    expect(screen.queryByTestId('hover-herhaling')).toBeNull();
    expect(screen.getByText('Veltenaar, Bart, B')).toBeInTheDocument();
  });

  it('zet elke taak op zijn eigen regel en noemt een enkele taak enkelvoud', async () => {
    render(
      <PlannerDaypartHoverPreview
        {...basis}
        activityName="OK Longtransplantatie"
        taskNames={[{ naam: 'Spoedsein Utrecht' }, { naam: 'Consulten Utrecht' }]}
      >
        <span>fiche</span>
      </PlannerDaypartHoverPreview>
    );

    openHover();

    const taken = await waitFor(() => screen.getByTestId('hover-taken'));
    expect(taken.querySelectorAll('p')).toHaveLength(2);
    expect(taken).toHaveTextContent('Spoedsein Utrecht');
    expect(taken).toHaveTextContent('Consulten Utrecht');
    expect(screen.getByText('Taken')).toBeInTheDocument();
    expect(screen.getByTestId('hover-activiteit')).toHaveTextContent('OK Longtransplantatie');
  });

  it('zet het inbelnummer op een eigen regel en niet achter de taaknaam', async () => {
    render(
      <PlannerDaypartHoverPreview
        {...basis}
        taskNames={[
          { naam: 'Extern consult', inbelnummer: '088 123 4567' },
          { naam: 'Supervisie', inbelnummer: null },
        ]}
      >
        <span>fiche</span>
      </PlannerDaypartHoverPreview>
    );

    openHover();

    const taken = await waitFor(() => screen.getByTestId('hover-taken'));
    expect(taken).not.toHaveTextContent('088 123 4567');
    expect(screen.getByTestId('hover-inbellen')).toHaveTextContent('088 123 4567');
    expect(screen.getByText('Inbellen')).toBeInTheDocument();
  });

  it('noemt de taak erbij zodra twee taken een nummer hebben', async () => {
    render(
      <PlannerDaypartHoverPreview
        {...basis}
        taskNames={[
          { naam: 'Extern consult', inbelnummer: '088 123 4567' },
          { naam: 'Extern consult oncologie', inbelnummer: '088 765 4321' },
        ]}
      >
        <span>fiche</span>
      </PlannerDaypartHoverPreview>
    );

    openHover();

    const inbellen = await waitFor(() => screen.getByTestId('hover-inbellen'));
    expect(inbellen.querySelectorAll('p')).toHaveLength(2);
    expect(inbellen).toHaveTextContent('Extern consult 088 123 4567');
    expect(inbellen).toHaveTextContent('Extern consult oncologie 088 765 4321');
  });

  it('laat de regel weg als een inbelbare taak geen nummer heeft', async () => {
    render(
      <PlannerDaypartHoverPreview {...basis} taskNames={[{ naam: 'Supervisie', inbelnummer: null }]}>
        <span>fiche</span>
      </PlannerDaypartHoverPreview>
    );

    openHover();

    await waitFor(() => screen.getByTestId('hover-taken'));
    expect(screen.queryByTestId('hover-inbellen')).toBeNull();
  });

  it('noemt een dagdeel met een enkele taak Taak', async () => {
    render(
      <PlannerDaypartHoverPreview {...basis} taskNames={[{ naam: 'Spoedsein Utrecht' }]}>
        <span>fiche</span>
      </PlannerDaypartHoverPreview>
    );

    openHover();

    await waitFor(() => screen.getByTestId('hover-taken'));
    expect(screen.getByText('Taak')).toBeInTheDocument();
  });

  it('zegt niets over absentie als er niets is aangevraagd', async () => {
    render(
      <PlannerDaypartHoverPreview {...basis}>
        <span>fiche</span>
      </PlannerDaypartHoverPreview>
    );

    openHover();

    await waitFor(() => screen.getByTestId('hover-herhaling'));
    expect(screen.queryByTestId('hover-absentie')).toBeNull();
  });
});
