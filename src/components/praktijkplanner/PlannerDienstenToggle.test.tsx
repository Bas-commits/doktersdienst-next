/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlannerDienstenToggle } from './PlannerDienstenToggle';

afterEach(cleanup);

describe('PlannerDienstenToggle', () => {
  it('staat aan als diensten automatisch getoond worden', () => {
    render(<PlannerDienstenToggle aan onChange={() => {}} />);

    const knop = screen.getByRole('button', { name: 'Diensten niet meer automatisch tonen' });
    expect(knop.getAttribute('aria-pressed')).toBe('true');
  });

  it('vraagt om automatisch tonen als de knop uit staat', () => {
    const onChange = vi.fn();
    render(<PlannerDienstenToggle aan={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Diensten automatisch tonen' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('is grijs gevuld in de uit-stand, niet wit', () => {
    render(<PlannerDienstenToggle aan={false} onChange={() => {}} />);

    const knop = screen.getByRole('button', { name: 'Diensten automatisch tonen' });
    expect(knop.className).toContain('bg-muted');
  });
});
