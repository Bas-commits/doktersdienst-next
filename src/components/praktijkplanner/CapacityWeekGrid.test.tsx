/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CapacityWeekGrid } from './CapacityWeekGrid';

const dayparts = [
  { id: 1, naam: 'Ochtend', volgorde: 1 },
  { id: 4, naam: 'Nacht', volgorde: 4 },
];

afterEach(cleanup);

describe('CapacityWeekGrid', () => {
  it('toont Niet inplanbaar zolang er niets anders voor dat vakje is', () => {
    render(
      <CapacityWeekGrid
        dayparts={dayparts}
        renderCell={(weekday, daypart) => <span>{`${weekday.id}-${daypart.id}`}</span>}
        isCellUnavailable={(_weekday, daypart) => daypart.id === 4}
      />
    );

    expect(screen.getAllByText('Niet inplanbaar')).toHaveLength(7);
    expect(screen.queryByText('1-4')).not.toBeInTheDocument();
  });

  it('zet de dienst in een niet-inplanbaar vakje in plaats van die tekst', () => {
    render(
      <CapacityWeekGrid
        dayparts={dayparts}
        renderCell={(weekday, daypart) => <span>{`${weekday.id}-${daypart.id}`}</span>}
        isCellUnavailable={(_weekday, daypart) => daypart.id === 4}
        // Alleen op maandagnacht staat een dienst; de rest houdt de gewone tekst.
        renderUnavailableCell={(weekday) => (weekday.id === 1 ? <span>Dienst 1/1</span> : null)}
      />
    );

    expect(screen.getByText('Dienst 1/1')).toBeInTheDocument();
    expect(screen.getAllByText('Niet inplanbaar')).toHaveLength(6);
  });
});
