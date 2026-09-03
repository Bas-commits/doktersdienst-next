import { describe, expect, it } from 'vitest';
import { nevenschermKeuzes } from './nevenscherm-keuzes';

describe('nevenschermKeuzes', () => {
  it('laat op Rooster inzien Week, Maand en Locatie over', () => {
    expect(nevenschermKeuzes({ alleenLezen: true, isBeheerder: false })).toEqual([
      'geen',
      'maand',
      'locatie',
    ]);
  });

  it('doet dat ook voor een beheerder, want het gaat om het scherm en niet om de rol', () => {
    expect(nevenschermKeuzes({ alleenLezen: true, isBeheerder: true })).toEqual([
      'geen',
      'maand',
      'locatie',
    ]);
  });

  it('houdt Capaciteit en Expertise weg op Rooster inzien, want die zijn er voor wie plant', () => {
    const keuzes = nevenschermKeuzes({ alleenLezen: true, isBeheerder: true });
    expect(keuzes).not.toContain('capaciteit');
    expect(keuzes).not.toContain('expertise');
  });

  it('geeft de planner ook Capaciteit, Expertise en Locatie', () => {
    expect(nevenschermKeuzes({ alleenLezen: false, isBeheerder: true })).toEqual([
      'geen',
      'maand',
      'capaciteit',
      'expertise',
      'locatie',
    ]);
  });

  it('houdt Capaciteit weg bij wie er geen recht op heeft', () => {
    expect(nevenschermKeuzes({ alleenLezen: false, isBeheerder: false })).not.toContain(
      'capaciteit'
    );
  });
});
