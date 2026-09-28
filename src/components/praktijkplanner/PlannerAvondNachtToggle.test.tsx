/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlannerAvondNachtToggle } from './PlannerAvondNachtToggle';

afterEach(cleanup);

describe('PlannerAvondNachtToggle', () => {
  it('staat aan als avond en nacht te zien zijn', () => {
    render(<PlannerAvondNachtToggle aan onChange={() => {}} />);

    const knop = screen.getByRole('button', { name: 'Avond en nacht verbergen' });
    expect(knop.getAttribute('aria-pressed')).toBe('true');
    expect(knop.className).toContain('bg-primary');
  });

  it('vraagt om tonen als avond en nacht weg zijn', () => {
    const onChange = vi.fn();
    render(<PlannerAvondNachtToggle aan={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Avond en nacht tonen' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('is wit in de uit-stand als er niets te verbergen is', () => {
    render(<PlannerAvondNachtToggle aan={false} onChange={() => {}} />);

    const knop = screen.getByRole('button', { name: 'Avond en nacht tonen' });
    const classes = knop.className.split(' ');
    expect(classes).not.toContain('bg-muted');
    expect(classes).not.toContain('bg-primary');
  });

  it('is grijs met een uitleg-tooltip als de knop een fiche verbergt', () => {
    render(<PlannerAvondNachtToggle aan={false} verbergtIets onChange={() => {}} />);

    const knop = screen.getByRole('button', { name: 'Avond en nacht tonen' });
    expect(knop.className.split(' ')).toContain('bg-muted-foreground');
    expect(knop.title).toMatch(/fiche/);
  });

  it('telt als getoond wanneer +Diensten hem overrulet, ook al staat de eigen voorkeur op verbergen', () => {
    const onChange = vi.fn();
    render(<PlannerAvondNachtToggle aan={false} getoond onChange={onChange} />);

    const knop = screen.getByRole('button', { name: 'Avond en nacht verbergen' });
    expect(knop.className).toContain('bg-primary');
    // Een klik stuurt de eigen voorkeur terug (aan omgekeerd), niet het overrulete resultaat.
    fireEvent.click(knop);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
