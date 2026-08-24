import { describe, expect, it } from 'vitest';
import {
  dienstTaakIds,
  dokterAfwezigheidsschermTitel,
  groepPlantDiensten,
  isDiensteis,
} from './diensten-in-groep';
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
    inbelnummer: null,
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

describe('dokterAfwezigheidsschermTitel', () => {
  it('noemt de dienstvoorkeur alleen als de groep diensten plant', () => {
    expect(dokterAfwezigheidsschermTitel(true)).toBe('Afwezigheids- en dienstvoorkeur');
    expect(dokterAfwezigheidsschermTitel(false)).toBe('Afwezigheidsplanner dokter');
  });
});

describe('isDiensteis', () => {
  const diensten = new Set([50]);

  it('herkent een taak en een groepstaak die een dienst is', () => {
    expect(isDiensteis('taak:50', diensten)).toBe(true);
    expect(isDiensteis('groepstaak:50', diensten)).toBe(true);
  });

  it('laat een gewone taak en andere soorten eisen buiten', () => {
    expect(isDiensteis('taak:51', diensten)).toBe(false);
    expect(isDiensteis('expertise:50', diensten)).toBe(false);
    expect(isDiensteis('totaal:2026-09-04:4', diensten)).toBe(false);
  });
});

describe('dienstTaakIds', () => {
  it('houdt alleen de diensttaken over', () => {
    expect([...dienstTaakIds([taak(), taak({ id: 50, isDienst: true })])]).toEqual([50]);
  });
});
