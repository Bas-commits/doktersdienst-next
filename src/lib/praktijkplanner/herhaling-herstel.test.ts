import { describe, expect, it } from 'vitest';
import { bronDatumVoorFiche } from './herhaling-herstel';

describe('bronDatumVoorFiche', () => {
  it('pakt dezelfde weekdag uit de bronweek', () => {
    // Donderdag 10 september hoort bij donderdag 20 augustus.
    expect(bronDatumVoorFiche('2026-08-17', '2026-09-10')).toBe('2026-08-20');
  });

  it('houdt de maandag op de maandag', () => {
    expect(bronDatumVoorFiche('2026-08-17', '2026-09-07')).toBe('2026-08-17');
  });

  it('houdt de zondag op de zondag', () => {
    expect(bronDatumVoorFiche('2026-08-17', '2026-09-13')).toBe('2026-08-23');
  });

  it('rekent goed door een zomertijdsprong heen', () => {
    // De klok gaat terug in de nacht van 24 op 25 oktober 2026.
    expect(bronDatumVoorFiche('2026-08-17', '2026-10-30')).toBe('2026-08-21');
  });

  it('werkt ook als de bronweek na de fiche ligt', () => {
    expect(bronDatumVoorFiche('2026-09-07', '2026-08-20')).toBe('2026-09-10');
  });
});
