/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlannerWeekendToggle } from './PlannerWeekendToggle';
import { metVerborgenWeekend } from '@/hooks/praktijkplanner/useWeekendVerbergen';

afterEach(cleanup);

describe('PlannerWeekendToggle', () => {
  it('staat aan als het weekend weg is', () => {
    render(<PlannerWeekendToggle verborgen onChange={() => {}} />);

    const knop = screen.getByRole('button', { name: 'Weekend tonen' });
    expect(knop.getAttribute('aria-pressed')).toBe('true');
  });

  it('vraagt om verbergen als het weekend er nog staat', () => {
    const onChange = vi.fn();
    render(<PlannerWeekendToggle verborgen={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Weekend verbergen' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('metVerborgenWeekend', () => {
  it('zet zaterdag en zondag bij de dagen die het rooster overslaat', () => {
    const basis = new Set([3]);

    expect([...metVerborgenWeekend(basis, true)].sort()).toEqual([3, 6, 7]);
  });

  it('laat de dagen zonder rooster met rust als de knop uit staat', () => {
    // Dezelfde verzameling terug, niet een kopie: anders rekent elk rooster zijn dagen opnieuw
    // uit zodra er iets anders op het scherm verandert.
    const basis = new Set([3]);

    expect(metVerborgenWeekend(basis, false)).toBe(basis);
  });
});
