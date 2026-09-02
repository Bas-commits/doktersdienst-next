import { describe, expect, it } from 'vitest';
import {
  overnameVerwijzingNaarQuery,
  overnameVerwijzingSleutel,
  overnameVerwijzingUitQuery,
  type OvernameVerwijzing,
} from '@/lib/overname-recreate';

const voorstel: OvernameVerwijzing = {
  iddienstovern: 0,
  idwaarneemgroep: 77,
  van: 1789797600,
  tot: 1789884000,
  iddeelnemer: 119,
  iddeelnovern: 1385,
};

describe('overname-recreate', () => {
  it('houdt een voorstel zonder nummer van de dienst overeind', () => {
    const query = Object.fromEntries(new URLSearchParams(overnameVerwijzingNaarQuery(voorstel)));

    // Nul is hier geen ontbrekende waarde maar de gewone stand van zaken: alle overnamerijen
    // in deze database hebben een lege id en de helft heeft geen dienstnummer.
    expect(overnameVerwijzingUitQuery(query)).toEqual(voorstel);
  });

  it('laat het nummer van de overnamerij weg als die er niet is', () => {
    const query = overnameVerwijzingNaarQuery(voorstel);

    expect(query).not.toContain('recreateProposal');
  });

  it('geeft niets terug als groep, begin of eind ontbreekt', () => {
    expect(overnameVerwijzingUitQuery({ recreate: '0' })).toBeNull();
    expect(
      overnameVerwijzingUitQuery({ recreate: '12', recreateGroep: '77', recreateVan: '100' })
    ).toBeNull();
  });

  it('geeft niets terug als het eind niet na het begin ligt', () => {
    expect(
      overnameVerwijzingUitQuery({
        recreateGroep: '77',
        recreateVan: '1789797600',
        recreateTot: '1789797600',
      })
    ).toBeNull();
  });

  it('onderscheidt twee voorstellen die allebei geen dienstnummer hebben', () => {
    const ander = { ...voorstel, van: voorstel.van + 86400, tot: voorstel.tot + 86400 };

    expect(overnameVerwijzingSleutel(voorstel)).not.toBe(overnameVerwijzingSleutel(ander));
  });
});
