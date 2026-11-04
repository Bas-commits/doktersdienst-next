/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlannerIconImage } from './PlannerIconImage';

afterEach(cleanup);

describe('PlannerIconImage', () => {
  it('toont de terugval als het bestand niet laadt', () => {
    render(
      <PlannerIconImage
        src="/icons/afwezigheidstypen-iconen/bestaat-niet.png"
        width={28}
        height={28}
        fallback={<span>Die</span>}
      />
    );

    const img = screen.getByRole('presentation', { hidden: true });
    fireEvent.error(img);

    expect(screen.getByText('Die')).toBeInTheDocument();
    expect(screen.queryByRole('presentation', { hidden: true })).toBeNull();
  });

  it('laat het icoon staan zolang het laadt', () => {
    render(
      <PlannerIconImage
        src="/icons/afwezigheidstypen-iconen/holliday.svg"
        width={28}
        height={28}
        fallback={<span>Vak</span>}
      />
    );

    expect(screen.getByRole('presentation', { hidden: true })).toBeInTheDocument();
    expect(screen.queryByText('Vak')).toBeNull();
  });
});
