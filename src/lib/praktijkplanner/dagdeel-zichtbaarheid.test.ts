import { describe, expect, it } from 'vitest';
import {
  heeftAvondOfNachtInhoud,
  isAvondOfNacht,
  zichtbareDagdelen,
} from './dagdeel-zichtbaarheid';
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

describe('heeftAvondOfNachtInhoud', () => {
  const zichtbaar = new Set([7]);
  const dag = '2026-08-17';

  it('ziet planning in de avond van een zichtbare deelnemer', () => {
    const planning = [{ iddeelnemer: 7, datum: dag, iddagdeel: 3 }];
    expect(heeftAvondOfNachtInhoud(planning, [], dagdelen, zichtbaar)).toBe(true);
  });

  it('telt een deelnemer die uit het filter valt niet mee', () => {
    const planning = [{ iddeelnemer: 9, datum: dag, iddagdeel: 4 }];
    expect(heeftAvondOfNachtInhoud(planning, [], dagdelen, zichtbaar)).toBe(false);
  });

  it('trekt zich niets aan van ochtend en middag', () => {
    const planning = [
      { iddeelnemer: 7, datum: dag, iddagdeel: 1 },
      { iddeelnemer: 7, datum: dag, iddagdeel: 2 },
    ];
    expect(heeftAvondOfNachtInhoud(planning, [], dagdelen, zichtbaar)).toBe(false);
  });

  it('houdt een week vakantie niet voor avondwerk', () => {
    // Vakantie wordt op alle vier de dagdelen gezet. Zou dat meetellen, dan was vrijwel elke
    // week gevuld en verdwenen de rijen nooit.
    const vakantie = [1, 2, 3, 4].map((iddagdeel) => ({ iddeelnemer: 7, datum: dag, iddagdeel }));
    expect(heeftAvondOfNachtInhoud([], vakantie, dagdelen, zichtbaar)).toBe(false);
  });

  it('ziet een absentie die alleen op de avond staat wel', () => {
    const absenties = [{ iddeelnemer: 7, datum: dag, iddagdeel: 3 }];
    expect(heeftAvondOfNachtInhoud([], absenties, dagdelen, zichtbaar)).toBe(true);
  });

  it('kijkt per dag, niet per week', () => {
    const absenties = [
      { iddeelnemer: 7, datum: '2026-08-17', iddagdeel: 1 },
      { iddeelnemer: 7, datum: '2026-08-18', iddagdeel: 4 },
    ];
    expect(heeftAvondOfNachtInhoud([], absenties, dagdelen, zichtbaar)).toBe(true);
  });
});

describe('zichtbareDagdelen', () => {
  it('laat avond en nacht weg als de periode leeg is', () => {
    expect(
      namen(zichtbareDagdelen(dagdelen, { heeftInhoud: false, toonAvondNacht: false }))
    ).toEqual(['Ochtend', 'Middag']);
  });

  it('zet ze terug in beeld met de knop, zodat er een eerste avond in kan', () => {
    expect(
      namen(zichtbareDagdelen(dagdelen, { heeftInhoud: false, toonAvondNacht: true }))
    ).toEqual(['Ochtend', 'Middag', 'Avond', 'Nacht']);
  });

  it('verbergt nooit iets wat gepland staat, ook niet met de knop uit', () => {
    expect(
      namen(zichtbareDagdelen(dagdelen, { heeftInhoud: true, toonAvondNacht: false }))
    ).toEqual(['Ochtend', 'Middag', 'Avond', 'Nacht']);
  });

  it('houdt overdag altijd zichtbaar', () => {
    for (const heeftInhoud of [false, true]) {
      for (const toonAvondNacht of [false, true]) {
        expect(namen(zichtbareDagdelen(dagdelen, { heeftInhoud, toonAvondNacht }))).toContain(
          'Ochtend'
        );
      }
    }
  });
});
