import { describe, expect, it } from 'vitest';
import { afwijkingTekst, herhalingTekst, herhalingWeekLabel } from './herhaling-tekst';

describe('herhaling teksten', () => {
  it('noemt de bronweek in dezelfde notatie als de weeknavigatie', () => {
    expect(herhalingWeekLabel('2026-08-10')).toBe('10 – 16 aug 2026');
  });

  it('vertelt bij een afwijking waarom het bordje er staat en van welke week', () => {
    expect(afwijkingTekst('2026-08-10')).toBe(
      'Dit dagdeel is afwijkend van de oorspronkelijke herhaling week 10 – 16 aug 2026.'
    );
  });

  it('laat de week weg bij een herhaling van voor de bronweek werd vastgelegd', () => {
    expect(afwijkingTekst(null)).toContain('niet vastgelegd');
    expect(afwijkingTekst(null)).not.toContain('week 1');
    expect(herhalingTekst(null)).toBe('Onderdeel van een herhaling.');
  });
});
