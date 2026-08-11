/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CapacityRequirementList, type CapacityRequirementSection } from './CapacityRequirementList';

// Deze opzet draait zonder globals, dus React Testing Library ruimt niet vanzelf op en elke
// render zou naast de vorige blijven staan.
afterEach(cleanup);

const sections: CapacityRequirementSection[] = [
  {
    key: 'taken',
    title: 'Taken',
    items: [
      { id: 1, label: 'Telefoon' },
      { id: 2, label: 'Visite' },
    ],
  },
];

function renderList(options: {
  waarden: Record<number, number>;
  normaal?: Record<number, number>;
  aantalDeelnemers?: number;
  normaalDeelnemers?: number;
}) {
  render(
    <CapacityRequirementList
      mode="edit"
      aantalDeelnemers={options.aantalDeelnemers ?? 2}
      onAantalDeelnemersChange={vi.fn()}
      sections={sections}
      getValue={(_sectionKey, itemId) => options.waarden[itemId] ?? 0}
      onValueChange={vi.fn()}
      normaal={
        options.normaal
          ? {
              aantalDeelnemers: options.normaalDeelnemers ?? 4,
              getValue: (_sectionKey, itemId) => options.normaal?.[itemId] ?? 0,
            }
          : undefined
      }
    />
  );
}

describe('CapacityRequirementList', () => {
  it('zet bij een regime de normale waarde en het verschil erbij', () => {
    renderList({ waarden: { 1: 1 }, normaal: { 1: 3 } });

    expect(screen.getByText('normaal 4, -2')).toBeTruthy();
    expect(screen.getByText('normaal 3, -2')).toBeTruthy();
  });

  it('laat het verschil weg als de eis gelijk is aan de normale week', () => {
    renderList({ waarden: { 1: 3 }, normaal: { 1: 3 } });

    expect(screen.getByText('normaal 3')).toBeTruthy();
  });

  it('toont niets bij een eis die in geen van beide weken geldt', () => {
    renderList({ waarden: { 1: 1 }, normaal: { 1: 3 } });

    // Visite staat op 0 in het regime en op 0 in de normale week. Zonder deze regel zou elke
    // cel volstaan met "normaal 0" bij elke ongebruikte eis.
    expect(screen.queryByText('normaal 0')).toBeNull();
  });

  it('toont geen normale waarden bij de normale week zelf', () => {
    renderList({ waarden: { 1: 3 } });

    expect(screen.queryByText(/normaal/)).toBeNull();
  });
});
