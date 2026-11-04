import { describe, expect, it } from 'vitest';
import { absentieTekst } from './absentie-tekst';

describe('absentie teksten', () => {
  it('noemt het aangevraagde type en dat het nog niet vaststaat', () => {
    expect(absentieTekst('Nascholing', true)).toBe(
      'Absentie aangevraagd: Nascholing. Nog niet goedgekeurd.'
    );
  });

  it('zegt bij een goedgekeurde absentie dat hij vaststaat', () => {
    expect(absentieTekst('Vakantie', false)).toBe('Absentie: Vakantie. Goedgekeurd.');
  });

  it('werkt zonder type zonder een leeg dubbelepunt achter te laten', () => {
    expect(absentieTekst(null, true)).toBe('Absentie aangevraagd. Nog niet goedgekeurd.');
    expect(absentieTekst(null, false)).toBe('Absentie. Goedgekeurd.');
  });
});
