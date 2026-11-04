import { describe, it, expect } from 'vitest';
import { buildLegacyOvernameRowConditions } from '@/lib/overname-legacy-lookup';

describe('buildLegacyOvernameRowConditions', () => {
  it('builds SQL for legacy rows with iddienstovern=0', () => {
    const sql = buildLegacyOvernameRowConditions({
      iddienstovern: 0,
      idwaarneemgroep: 9,
      van: 100,
      tot: 200,
    });
    expect(sql).toBeDefined();
    expect(typeof sql).toBe('object');
  });

  it('accepts null iddeelnemer without throwing (legacy PHP rows)', () => {
    expect(() =>
      buildLegacyOvernameRowConditions({
        idwaarneemgroep: 9,
        van: 100,
        tot: 200,
        iddeelnemer: null,
      }),
    ).not.toThrow();
  });

  it('accepts iddeelnovern for respond payloads from pending API', () => {
    expect(() =>
      buildLegacyOvernameRowConditions({
        iddienstovern: 0,
        idwaarneemgroep: 9,
        van: 100,
        tot: 200,
        iddeelnovern: 55,
      }),
    ).not.toThrow();
  });
});
