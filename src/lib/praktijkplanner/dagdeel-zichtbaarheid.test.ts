import { describe, expect, it } from 'vitest';
import { isAvondOfNacht, zichtbareDagdelen } from './dagdeel-zichtbaarheid';
import type { PraktijkplannerDaypart } from '@/types/praktijkplanner';

const dagdelen = [
  { id: 1, naam: 'Ochtend', volgorde: 1 },
  { id: 2, naam: 'Middag', volgorde: 2 },
  { id: 3, naam: 'Avond', volgorde: 3 },
  { id: 4, naam: 'Nacht', volgorde: 4 },
] as PraktijkplannerDaypart[];

const namen = (lijst: PraktijkplannerDaypart[]) => lijst.map((d) => d.naam);

describe('isAvondOfNacht', () => {
  it('rekent Avond bij de nacht en niet bij de dag', () => {
    expect(isAvondOfNacht({ volgorde: 2 })).toBe(false);
    expect(isAvondOfNacht({ volgorde: 3 })).toBe(true);
    expect(isAvondOfNacht({ volgorde: 4 })).toBe(true);
  });
});

describe('zichtbareDagdelen', () => {
  it('laat avond en nacht weg zodra de knop uit staat', () => {
    expect(namen(zichtbareDagdelen(dagdelen, { toonAvondNacht: false }))).toEqual([
      'Ochtend',
      'Middag',
    ]);
  });

  it('zet ze terug in beeld met de knop', () => {
    expect(namen(zichtbareDagdelen(dagdelen, { toonAvondNacht: true }))).toEqual([
      'Ochtend',
      'Middag',
      'Avond',
      'Nacht',
    ]);
  });

  it('houdt overdag altijd zichtbaar', () => {
    for (const toonAvondNacht of [false, true]) {
      expect(namen(zichtbareDagdelen(dagdelen, { toonAvondNacht }))).toContain('Ochtend');
    }
  });
});
