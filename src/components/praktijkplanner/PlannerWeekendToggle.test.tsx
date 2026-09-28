/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlannerWeekendToggle } from './PlannerWeekendToggle';
import { metVerborgenWeekend } from '@/hooks/praktijkplanner/useWeekendVerbergen';

afterEach(cleanup);

describe('PlannerWeekendToggle', () => {
  it('staat aan als het weekend te zien is', () => {
    render(<PlannerWeekendToggle getoond onChange={() => {}} />);

    const knop = screen.getByRole('button', { name: 'Weekend verbergen' });
    expect(knop.getAttribute('aria-pressed')).toBe('true');
    expect(knop.className).toContain('bg-primary');
  });

  it('vraagt om tonen als het weekend weg is', () => {
    const onChange = vi.fn();
    render(<PlannerWeekendToggle getoond={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Weekend tonen' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('is wit in de uit-stand als er niets te verbergen is', () => {
    render(<PlannerWeekendToggle getoond={false} onChange={() => {}} />);

    const knop = screen.getByRole('button', { name: 'Weekend tonen' });
    const classes = knop.className.split(' ');
    expect(classes).not.toContain('bg-muted');
    expect(classes).not.toContain('bg-primary');
  });

  it('is grijs met een uitleg-tooltip als de knop een dienst verbergt', () => {
    render(<PlannerWeekendToggle getoond={false} verbergtIets onChange={() => {}} />);

    const knop = screen.getByRole('button', { name: 'Weekend tonen' });
    expect(knop.className.split(' ')).toContain('bg-muted');
    expect(knop.title).toMatch(/dienst/);
  });

  it('telt als getoond wanneer +Diensten hem overrulet, ook al staat de eigen voorkeur op verbergen', () => {
    const onChange = vi.fn();
    render(<PlannerWeekendToggle getoond={false} effectiefGetoond onChange={onChange} />);

    const knop = screen.getByRole('button', { name: 'Weekend verbergen' });
    expect(knop.className).toContain('bg-primary');
    // Een klik stuurt de eigen voorkeur terug (getoond omgekeerd), niet het overrulete resultaat.
    fireEvent.click(knop);
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
