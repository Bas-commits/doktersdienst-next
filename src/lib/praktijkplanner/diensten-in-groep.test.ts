import { describe, expect, it } from 'vitest';
import { groepPlantDiensten } from './diensten-in-groep';
import type { PraktijkplannerTaskType } from '@/types/praktijkplanner';

function taak(overrides: Partial<PraktijkplannerTaskType> = {}): PraktijkplannerTaskType {
  return {
    id: 1,
    afkorting: 'SV',
    omschrijving: 'Supervisie',
    kleur: null,
    idexpertise: null,
    nietLocatieGebonden: false,
    inbelbaar: false,
    isDienst: false,
    actief: true,
    ...overrides,
  };
}

describe('groepPlantDiensten', () => {
  it('is onwaar zonder taaktypen en zonder diensttaak', () => {
    expect(groepPlantDiensten([])).toBe(false);
    expect(groepPlantDiensten([taak(), taak({ id: 2 })])).toBe(false);
  });

  it('is waar zodra een taaktype een dienst is', () => {
    expect(groepPlantDiensten([taak(), taak({ id: 2, isDienst: true })])).toBe(true);
  });
});
