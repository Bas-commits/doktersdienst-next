/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlannerMaandNavigatie } from './PlannerMaandNavigatie';

afterEach(cleanup);

describe('PlannerMaandNavigatie', () => {
  it('noemt de maand die getoond wordt', () => {
    render(<PlannerMaandNavigatie year={2026} month={9} onMaandVerzetten={vi.fn()} />);

    expect(screen.getByText('september 2026')).not.toBeNull();
  });

  it('geeft de stap door in plaats van een maand', () => {
    const onMaandVerzetten = vi.fn();
    render(<PlannerMaandNavigatie year={2026} month={1} onMaandVerzetten={onMaandVerzetten} />);

    fireEvent.click(screen.getByRole('button', { name: 'Vorige maand' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volgende maand' }));

    // Wie de stap opvangt rekent hem om naar een week. Januari terug is december van het jaar
    // ervoor, en dat is precies waarom deze knop geen maand uitrekent.
    expect(onMaandVerzetten.mock.calls).toEqual([[-1], [1]]);
  });
});
