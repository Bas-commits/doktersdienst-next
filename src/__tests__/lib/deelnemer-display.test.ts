import { describe, expect, it } from 'vitest';
import {
  deelnemerChipInitials,
  deelnemerInitialsFromDisplayName,
  formatDeelnemerDisplayName,
} from '@/lib/deelnemer-display';
import { headerUserFromSession } from '@/lib/header-defaults';

describe('formatDeelnemerDisplayName', () => {
  it('prefers the editable name fields over the stale name column', () => {
    expect(
      formatDeelnemerDisplayName({
        name: 'Jan',
        voornaam: 'Jan',
        voorletterstussenvoegsel: 'J. de',
        achternaam: 'Tester',
      })
    ).toBe('Jan J. de Tester');
  });

  it('falls back to the name column when no name fields are set', () => {
    expect(formatDeelnemerDisplayName({ name: 'Dr. Jan' })).toBe('Dr. Jan');
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

describe('deelnemerChipInitials', () => {
  it('prefers initialen from mijn-gegevens', () => {
    expect(
      deelnemerChipInitials({
        initialen: 'B.V.',
        voornaam: 'Bas',
        achternaam: 'Veltenaar',
      })
    ).toBe('B.V.');
  });

  it('falls back to voornaam and achternaam when initialen is empty', () => {
    expect(
      deelnemerChipInitials({
        voornaam: 'Anna',
        achternaam: 'Jansen',
      })
    ).toBe('AJ');
  });
});

describe('headerUserFromSession', () => {
  it('prefers initialen from mijn-gegevens over derived initials', () => {
    const headerUser = headerUserFromSession(
      { name: 'Bas van Veltenaar', email: 'bas@example.com', role: 'user' },
      { displayName: 'Bas van Veltenaar', initialen: 'B.V.' }
    );
    expect(headerUser.ShortName).toBe('B.V.');
  });

  it('falls back to derived initials when initialen is empty', () => {
    const headerUser = headerUserFromSession(
      { name: 'Bas van Veltenaar', email: 'bas@example.com', role: 'user' },
      { displayName: 'Bas van Veltenaar', initialen: null }
    );
    expect(headerUser.ShortName).toBe('BV');
  });
});
