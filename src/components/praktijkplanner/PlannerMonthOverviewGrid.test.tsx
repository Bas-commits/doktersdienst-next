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
    expect(screen.getByText('Week 31').closest('th')?.getAttribute('colspan')).toBe('2');
    expect(screen.getByTitle('Week 32, 3 – 9 aug').getAttribute('colspan')).toBe('7');
    // 31 augustus is de enige dag van week 36 die in deze maand valt, en in één kolom past
    // alleen het korte nummer.
    expect(screen.getByText('W36').closest('th')?.getAttribute('colspan')).toBe('1');
  });

  it('noemt bij de weekkop de hele week, ook als de maand er middenin begint', () => {
    renderGrid({ month: 9 });

    // September 2026 begint op dinsdag, dus van week 36 staan hier alleen 1 tot en met 6. De
    // kop hoort de week te noemen zoals de weekbalk dat doet, dus vanaf maandag 31 augustus.
    expect(screen.getByTitle('Week 36, 31 aug – 6 sep')).not.toBeNull();
  });

  it('geeft elke deelnemer een rij per dagdeel', () => {
    renderGrid();

    const naam = screen.getByText('Achout, Carola');
    expect(naam.closest('th')?.getAttribute('rowspan')).toBe('2');
    // De letterkolom O/M/A/N is weg. De rijkop blijft er voor een schermlezer wel, met de
    // hele naam van het dagdeel erin.
    const tabel = screen.getByRole('table');
    expect(within(tabel).getAllByText('Ochtend').length).toBe(participants.length);
    expect(within(tabel).getAllByText('Middag').length).toBe(participants.length);
    expect(within(tabel).queryByText('O')).toBeNull();
  });

  it('geeft elke rij precies zoveel vakjes als er datums in de kop staan', () => {
    renderGrid();

    /*
      Een cel te veel in de rij en alles schuift een dag op ten opzichte van de datumkop,
      zonder dat er iets scheef uitziet. Dat gebeurde toen de rij een eigen kop kreeg voor de
      naam van het dagdeel: die telde als kolom en de kop had er geen.
    */
    const tabel = screen.getByRole('table');
    const datumrij = tabel.querySelectorAll('thead tr')[1];
    const dagen = datumrij.querySelectorAll('th').length;
    expect(dagen).toBe(31);

    for (const rij of tabel.querySelectorAll('tbody tr')) {
      expect(rij.querySelectorAll('td').length).toBe(dagen);
      // Alleen de namenkolom mag nog een kop zijn, en die staat op de eerste rij van elke
      // deelnemer. Elke extra kop is een kolom die de datumkop niet heeft.
      expect(rij.querySelectorAll('th').length).toBeLessThanOrEqual(1);
    }
  });

  it('zet het plaatje van het dagdeel alleen in een leeg vakje', () => {
    renderGrid({
      isCellFilled: ({ datum }) => datum === '2026-08-03',
    });

    // Twee deelnemers, twee dagdelen, 31 dagen, waarvan er één gevuld is.
    const plaatjes = screen.getAllByRole('presentation', { hidden: true });
    expect(plaatjes.length).toBe(2 * 2 * 30);
  });

  it('tekent geen plaatje als het rooster niet weet wat er gevuld is', () => {
    renderGrid();

    expect(screen.queryAllByRole('presentation', { hidden: true }).length).toBe(0);
  });

  it('laat de kop staan als je door de rijen scrolt', () => {
    renderGrid();

    // De weeknummerrij plakt bovenaan, de datumrij eronder. Zonder dit verdween de kop zodra
    // je naar beneden scrolde en wist je bij de vierde deelnemer niet meer welke dag welke was.
    const week = screen.getByTitle('Week 32, 3 – 9 aug');
    expect(week.className).toContain('sticky');
    expect(week.style.top).toBe('0px');

    const dag = screen.getByText('15').closest('th');
    expect(dag?.className).toContain('sticky');
    expect(dag?.style.top).toBe(week.style.height);
    expect(dag?.style.top).not.toBe('0px');
  });

  it('legt de kop boven de fiches en boven de namenkolom', () => {
    renderGrid();

    // Het vlaggetje op een fiche staat op z-20. Ligt de kop daar niet boven, dan piepen er
    // stukjes fiche doorheen, want bij gelijke laag wint wat later in de HTML staat.
    const hoek = screen.getByText('Deelnemer');
    const week = screen.getByTitle('Week 32, 3 – 9 aug');
    const naam = screen.getByText('Achout, Carola').closest('th');

    expect(hoek.className).toContain('z-50');
    expect(week.className).toContain('z-40');
    expect(naam?.className).toContain('z-30');
  });

  it('markeert een feestdag bij de dag zelf', () => {
    renderGrid({ holidayLabels: new Map([['2026-08-15', ['Maria Hemelvaart']]]) });

    const dag = screen.getByTitle('Maria Hemelvaart');
    expect(within(dag).getByText('15')).toBeInTheDocument();
  });
});
