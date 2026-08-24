import { describe, expect, it } from 'vitest';
import { nevenschermKeuzes } from './nevenscherm-keuzes';

describe('nevenschermKeuzes', () => {
  it('laat op Rooster inzien alleen Week en Maand over', () => {
    expect(nevenschermKeuzes({ alleenLezen: true, isBeheerder: false })).toEqual([
      'geen',
      'maand',
    ]);
  });

  it('doet dat ook voor een beheerder, want het gaat om het scherm en niet om de rol', () => {
    expect(nevenschermKeuzes({ alleenLezen: true, isBeheerder: true })).toEqual(['geen', 'maand']);
  });

  it('geeft de planner ook Capaciteit en Expertise', () => {
    expect(nevenschermKeuzes({ alleenLezen: false, isBeheerder: true })).toEqual([
      'geen',
      'maand',
      'capaciteit',
      'expertise',
    ]);
  });

  it('houdt Capaciteit weg bij wie er geen recht op heeft', () => {
    expect(nevenschermKeuzes({ alleenLezen: false, isBeheerder: false })).not.toContain(
      'capaciteit'
    );
  });
});
