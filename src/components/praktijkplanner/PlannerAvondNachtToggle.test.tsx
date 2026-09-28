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
  });

  it('vraagt om tonen als avond en nacht weg zijn', () => {
    const onChange = vi.fn();
    render(<PlannerAvondNachtToggle aan={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Avond en nacht tonen' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toont grijs met een uitleg-tooltip als +Diensten avond/nacht overrulet', () => {
    render(<PlannerAvondNachtToggle aan={false} overruled onChange={() => {}} />);

    const knop = screen.getByRole('button', { name: 'Avond en nacht tonen' });
    expect(knop.className).toContain('bg-muted');
    expect(knop.title).toMatch(/\+Diensten/);
  });
});
