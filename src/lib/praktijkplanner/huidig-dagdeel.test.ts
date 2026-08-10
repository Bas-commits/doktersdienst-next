import { describe, expect, it } from 'vitest';
import {
  DAGDEEL_AVOND,
  DAGDEEL_MIDDAG,
  DAGDEEL_NACHT,
  DAGDEEL_OCHTEND,
  huidigMoment,
  huidigeDagdeelVolgorde,
} from './huidig-dagdeel';

function op(datum: string, uur: number): Date {
  return new Date(`${datum}T${String(uur).padStart(2, '0')}:30:00`);
}

describe('huidig dagdeel', () => {
  it('legt de grenzen op 07:00, 12:00, 17:00 en 23:00', () => {
    expect(huidigeDagdeelVolgorde(op('2026-08-10', 7))).toBe(DAGDEEL_OCHTEND);
    expect(huidigeDagdeelVolgorde(op('2026-08-10', 11))).toBe(DAGDEEL_OCHTEND);
    expect(huidigeDagdeelVolgorde(op('2026-08-10', 12))).toBe(DAGDEEL_MIDDAG);
    expect(huidigeDagdeelVolgorde(op('2026-08-10', 16))).toBe(DAGDEEL_MIDDAG);
    expect(huidigeDagdeelVolgorde(op('2026-08-10', 17))).toBe(DAGDEEL_AVOND);
    expect(huidigeDagdeelVolgorde(op('2026-08-10', 22))).toBe(DAGDEEL_AVOND);
    expect(huidigeDagdeelVolgorde(op('2026-08-10', 23))).toBe(DAGDEEL_NACHT);
  });

  it('rekent de uren na middernacht bij de nieuwe dag, niet bij de nacht ervoor', () => {
    expect(huidigMoment(op('2026-08-11', 2))).toEqual({
      datum: '2026-08-11',
      volgorde: DAGDEEL_NACHT,
    });
    expect(huidigMoment(op('2026-08-11', 6))).toEqual({
      datum: '2026-08-11',
      volgorde: DAGDEEL_NACHT,
    });
  });

  it('geeft de dag van de klok terug, ook laat op de avond', () => {
    expect(huidigMoment(op('2026-08-10', 23))).toEqual({
      datum: '2026-08-10',
      volgorde: DAGDEEL_NACHT,
    });
  });
});
