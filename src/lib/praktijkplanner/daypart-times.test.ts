import { describe, expect, it } from 'vitest';
import {
  halfIngevuldeDagdelen,
  normaliseerTijd,
  tijdenPerDagdeel,
  tijdLabel,
  volledigIngevuldeTijden,
} from './daypart-times';
import type { PraktijkplannerDaypart } from '@/types/praktijkplanner';

const dayparts = [
  { id: 2, naam: 'Middag', volgorde: 2 },
  { id: 1, naam: 'Ochtend', volgorde: 1 },
] as PraktijkplannerDaypart[];

describe('normaliseerTijd', () => {
  it('haalt de seconden eraf die postgres meestuurt', () => {
    expect(normaliseerTijd('08:00:00')).toBe('08:00');
  });

  it('vult een uur van een cijfer aan', () => {
    expect(normaliseerTijd('8:05')).toBe('08:05');
  });

  it('maakt alles leeg wat geen tijd is', () => {
    expect(normaliseerTijd('')).toBe('');
    expect(normaliseerTijd(null)).toBe('');
    expect(normaliseerTijd('halfnegen')).toBe('');
    expect(normaliseerTijd('24:00')).toBe('');
    expect(normaliseerTijd('08:60')).toBe('');
  });
});

describe('tijdenPerDagdeel', () => {
  it('geeft elk dagdeel een regel, op volgorde, ook zonder opgeslagen tijd', () => {
    const regels = tijdenPerDagdeel(dayparts, [
      { iddagdeel: 1, begintijd: '08:00:00', eindtijd: '13:00:00' },
    ]);

    expect(regels).toEqual([
      { iddagdeel: 1, begintijd: '08:00', eindtijd: '13:00' },
      { iddagdeel: 2, begintijd: '', eindtijd: '' },
    ]);
  });
});

describe('volledigIngevuldeTijden', () => {
  it('laat een half ingevulde regel weg', () => {
    expect(
      volledigIngevuldeTijden([
        { iddagdeel: 1, begintijd: '08:00', eindtijd: '13:00' },
        { iddagdeel: 2, begintijd: '13:00', eindtijd: '' },
        { iddagdeel: 3, begintijd: '', eindtijd: '' },
      ])
    ).toEqual([{ iddagdeel: 1, begintijd: '08:00', eindtijd: '13:00' }]);
  });

  it('houdt een dagdeel dat over middernacht heen loopt', () => {
    // De nacht van 23:00 tot 07:00 is geldig; alleen de volgorde van de cijfers ziet er raar uit.
    expect(
      volledigIngevuldeTijden([{ iddagdeel: 4, begintijd: '23:00', eindtijd: '07:00' }])
    ).toEqual([{ iddagdeel: 4, begintijd: '23:00', eindtijd: '07:00' }]);
  });
});

describe('halfIngevuldeDagdelen', () => {
  it('noemt alleen de dagdelen met precies een van de twee tijden', () => {
    expect(
      halfIngevuldeDagdelen([
        { iddagdeel: 1, begintijd: '08:00', eindtijd: '13:00' },
        { iddagdeel: 2, begintijd: '13:00', eindtijd: '' },
        { iddagdeel: 3, begintijd: '', eindtijd: '18:00' },
        { iddagdeel: 4, begintijd: '', eindtijd: '' },
      ])
    ).toEqual([2, 3]);
  });
});

describe('tijdLabel', () => {
  it('zet de twee tijden achter elkaar', () => {
    expect(tijdLabel([{ iddagdeel: 1, begintijd: '08:00:00', eindtijd: '13:00:00' }], 1)).toBe(
      '08:00 - 13:00'
    );
  });

  it('geeft niets terug voor een dagdeel zonder tijd', () => {
    expect(tijdLabel([], 1)).toBe('');
  });
});
