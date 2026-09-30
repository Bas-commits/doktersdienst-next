import { describe, expect, it } from 'vitest';
import { toDienstenResponse } from '@/hooks/useDienstenSubscription';
import { dienstenToShiftBlocks } from '@/hooks/useDienstenSchedule';
import { SHIFT_VAN, SHIFT_TOT, WG_ID } from './fixtures';

describe('toDienstenResponse', () => {
  it('preserves initialen on diensten_deelnemers', () => {
    const response = toDienstenResponse([
      {
        id: 1,
        iddeelnemer: 42,
        van: SHIFT_VAN,
        tot: SHIFT_TOT,
        type: 0,
        idwaarneemgroep: WG_ID,
        diensten_deelnemers: {
          id: 42,
          voornaam: 'Bas',
          achternaam: 'Veltenaar',
          initialen: 'B.V.',
          color: '#336699',
        },
      },
    ]);

    expect(response.data.diensten[0].diensten_deelnemers?.initialen).toBe('B.V.');
  });

  it('preserves initialen on target_deelnemers', () => {
    const response = toDienstenResponse([
      {
        id: 2,
        iddeelnemer: 10,
        van: SHIFT_VAN,
        tot: SHIFT_TOT,
        type: 4,
        idwaarneemgroep: WG_ID,
        diensten_deelnemers: {
          id: 10,
          voornaam: 'Jan',
          achternaam: 'Arts',
          initialen: 'J.A.',
          color: '#111111',
        },
        target_deelnemers: {
          id: 20,
          voornaam: 'Piet',
          achternaam: 'Doel',
          initialen: 'P.D.',
          color: '#222222',
        },
      },
    ]);

    expect(response.data.diensten[0].target_deelnemers?.initialen).toBe('P.D.');
  });

  it('produces correct shift block shortName after normalization', () => {
    const response = toDienstenResponse([
      {
        id: 100,
        iddeelnemer: 0,
        van: SHIFT_VAN,
        tot: SHIFT_TOT,
        type: 1,
        idwaarneemgroep: WG_ID,
        diensten_deelnemers: null,
      },
      {
        id: 101,
        iddeelnemer: 42,
        van: SHIFT_VAN,
        tot: SHIFT_TOT,
        type: 0,
        idwaarneemgroep: WG_ID,
        diensten_deelnemers: {
          id: 42,
          voornaam: 'Bas',
          achternaam: 'Veltenaar',
          initialen: 'B.V.',
          color: '#336699',
        },
      },
    ]);

    const blocks = dienstenToShiftBlocks(response);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].middle?.shortName).toBe('B.V.');
  });

  it('keeps the lane of an overname through to the shift block', () => {
    // The field was dropped here once, so an achterwacht overname landed on the dienst row.
    const response = toDienstenResponse([
      {
        id: null,
        iddeelnemer: 42,
        van: SHIFT_VAN,
        tot: SHIFT_TOT,
        type: 4,
        idwaarneemgroep: WG_ID,
        status: 'pending',
        iddeelnovern: 43,
        overnameSectie: 'top',
        diensten_deelnemers: { id: 42, voornaam: 'Bas', achternaam: 'Veltenaar', initialen: 'BV', color: '#336699' },
      } as Parameters<typeof toDienstenResponse>[0][number],
    ]);

    expect(response.data.diensten[0].overnameSectie).toBe('top');
    const overlay = dienstenToShiftBlocks(response).find((b) => b.overnameType);
    expect(overlay?.overnameSectie).toBe('top');
  });
});
