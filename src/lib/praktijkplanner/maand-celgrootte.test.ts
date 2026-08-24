import { describe, expect, it } from 'vitest';
import {
  MAAND_CEL_MATEN,
  MAAND_CEL_STANDAARD,
  toontTekstInMaand,
  volgendeCelGrootte,
} from './maand-celgrootte';

describe('volgendeCelGrootte', () => {
  it('gaat een stap in en een stap uit', () => {
    expect(volgendeCelGrootte(34, 'in')).toBe(44);
    expect(volgendeCelGrootte(44, 'uit')).toBe(34);
  });

  it('blijft staan aan beide uiteinden in plaats van om te lopen', () => {
    const grootste = MAAND_CEL_MATEN[MAAND_CEL_MATEN.length - 1];
    expect(volgendeCelGrootte(grootste, 'in')).toBe(grootste);
    expect(volgendeCelGrootte(MAAND_CEL_STANDAARD, 'uit')).toBe(MAAND_CEL_STANDAARD);
  });

  it('valt terug op de standaard bij een maat die niet in de rij staat', () => {
    expect(volgendeCelGrootte(41, 'in')).toBe(MAAND_CEL_STANDAARD);
  });
});

describe('toontTekstInMaand', () => {
  it('houdt de tekst weg zolang het vakje kleiner is dan de weekmaat', () => {
    expect(toontTekstInMaand(34)).toBe(false);
    expect(toontTekstInMaand(44)).toBe(false);
  });

  it('laat de tekst zien vanaf de weekmaat', () => {
    expect(toontTekstInMaand(56)).toBe(true);
    expect(toontTekstInMaand(72)).toBe(true);
  });
});
