/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlannerMonthOverviewGrid } from './PlannerMonthOverviewGrid';
import type { PraktijkplannerDaypart, PraktijkplannerParticipant } from '@/types/praktijkplanner';

afterEach(cleanup);

const dayparts = [
  { id: 1, naam: 'Ochtend', volgorde: 1 },
  { id: 2, naam: 'Middag', volgorde: 2 },
] as PraktijkplannerDaypart[];

const participants = [
  { id: 1, achternaam: 'Achout', voornaam: 'Carola' },
  { id: 2, achternaam: 'Jansen', voornaam: 'Jan' },
] as PraktijkplannerParticipant[];

function renderGrid(extra: Partial<Parameters<typeof PlannerMonthOverviewGrid>[0]> = {}) {
  return render(
    <PlannerMonthOverviewGrid
      participants={participants}
      dayparts={dayparts}
      year={2026}
      month={8}
      renderCell={({ datum, daypart }) => <span>{`${datum}-${daypart.id}`}</span>}
      {...extra}
    />
  );
}

describe('PlannerMonthOverviewGrid', () => {
  it('zet elke dag van de maand als eigen kolom neer', () => {
    renderGrid();

    // Augustus 2026 heeft 31 dagen, en elke deelnemer heeft een rij per dagdeel.
    expect(screen.getAllByText('2026-08-01-1')).toHaveLength(participants.length);
    expect(screen.getAllByText('2026-08-31-2')).toHaveLength(participants.length);
    expect(screen.queryByText('2026-09-01-1')).toBeNull();
    expect(screen.queryByText('2026-07-31-1')).toBeNull();
  });

  it('groepeert de dagen onder hun weeknummer', () => {
    renderGrid();

    // 1 augustus 2026 is een zaterdag, dus de eerste week is er maar twee dagen van te zien.
    const eersteWeek = screen.getByText('Week 31');
    expect(eersteWeek.getAttribute('colspan')).toBe('2');
    expect(screen.getByText('Week 32').getAttribute('colspan')).toBe('7');
    expect(screen.getByText('Week 36').getAttribute('colspan')).toBe('1');
  });

  it('geeft elke deelnemer een rij per dagdeel', () => {
    renderGrid();

    const naam = screen.getByText('Achout, Carola');
    expect(naam.closest('th')?.getAttribute('rowspan')).toBe('2');
    const tabel = screen.getByRole('table');
    expect(within(tabel).getAllByText('O').length).toBe(participants.length);
    expect(within(tabel).getAllByText('M').length).toBe(participants.length);
  });

  it('markeert een feestdag bij de dag zelf', () => {
    renderGrid({ holidayLabels: new Map([['2026-08-15', ['Maria Hemelvaart']]]) });

    const dag = screen.getByTitle('Maria Hemelvaart');
    expect(within(dag).getByText('15')).toBeInTheDocument();
  });
});
