/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AbsenceDaypartCell } from './AbsenceDaypartCell';

afterEach(cleanup);

const vakantie = { naam: 'Vakantie', code: 'vakantie', kleur: '#e11d48', icon: null };

describe('AbsenceDaypartCell', () => {
  it('zet de initialen van de deelnemer onderaan, net als op een fiche', () => {
    render(
      <AbsenceDaypartCell
        absence={vakantie}
        participantColor="#86fdc6"
        participantInitials="BHV"
      />
    );

    expect(screen.getByText('BHV')).toBeInTheDocument();
  });

  it('laat de initialen weg in de maandweergave', () => {
    // Daar is een vakje ongeveer 34 pixels en hangt het bolletje over de rij eronder, terwijl
    // de naam daar al aan het begin van de rij staat.
    render(
      <AbsenceDaypartCell
        absence={vakantie}
        participantColor="#86fdc6"
        participantInitials="BHV"
        density="micro"
      />
    );

    expect(screen.queryByText('BHV')).toBeNull();
  });

  it('laat de initialen weg zonder kleur van de deelnemer', () => {
    // Zonder deelnemer is er geen kader en dus ook geen kleur om het bolletje mee te vullen.
    render(<AbsenceDaypartCell absence={vakantie} participantInitials="BHV" />);

    expect(screen.queryByText('BHV')).toBeNull();
  });
});
