import { describe, expect, it } from 'vitest';
import {
  deelnemerInitialsFromDisplayName,
  formatDeelnemerDisplayName,
} from '@/lib/deelnemer-display';

describe('formatDeelnemerDisplayName', () => {
  it('prefers name column when set', () => {
    expect(
      formatDeelnemerDisplayName({
        name: 'Dr. Jan',
        voornaam: 'Jan',
        achternaam: 'Tester',
      })
    ).toBe('Dr. Jan');
  });

  it('builds from voornaam and achternaam when name is empty', () => {
    expect(
      formatDeelnemerDisplayName({
        name: null,
        voornaam: 'Bas',
        voorletterstussenvoegsel: 'van',
        achternaam: 'Veltenaar',
      })
    ).toBe('Bas van Veltenaar');
  });

  it('returns null when no name fields are set', () => {
    expect(formatDeelnemerDisplayName({})).toBeNull();
  });
});

describe('deelnemerInitialsFromDisplayName', () => {
  it('uses first letters of each word', () => {
    expect(deelnemerInitialsFromDisplayName('Bas van Veltenaar')).toBe('BV');
  });
});
