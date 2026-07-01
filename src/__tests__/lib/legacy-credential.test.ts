import { describe, expect, it } from 'vitest';
import {
  isBcryptHash,
  normalizeBcryptHashForVerify,
  resolveStoredCredentialHash,
} from '@/lib/legacy-credential';
import { PASSWORD_UPGRADED_MARKER } from '@/lib/account-password-upgrade';

describe('resolveStoredCredentialHash', () => {
  it('prefers encrypted_password MD5 when present', () => {
    expect(
      resolveStoredCredentialHash({
        encrypted_password: 'ABCDEF0123456789ABCDEF0123456789',
        password: '$2y$10$abc',
      })
    ).toBe('ABCDEF0123456789ABCDEF0123456789');
  });

  it('falls back to bcrypt in password column', () => {
    const bcrypt = '$2y$10$/FM.J9lXnR3sZw.VktB9EezQcH2y2sAvOy5t54W2yUab4HXI.u2Le';
    expect(
      resolveStoredCredentialHash({
        encrypted_password: null,
        password: bcrypt,
      })
    ).toBe(bcrypt);
  });

  it('ignores password upgrade marker', () => {
    expect(
      resolveStoredCredentialHash({
        encrypted_password: null,
        password: PASSWORD_UPGRADED_MARKER,
      })
    ).toBeNull();
  });
});

describe('isBcryptHash', () => {
  it('detects php bcrypt hashes', () => {
    expect(isBcryptHash('$2y$10$/FM.J9lXnR3sZw.VktB9EezQcH2y2sAvOy5t54W2yUab4HXI.u2Le')).toBe(
      true
    );
    expect(isBcryptHash('ABCDEF0123456789ABCDEF0123456789')).toBe(false);
  });
});

describe('normalizeBcryptHashForVerify', () => {
  it('converts php $2y$ prefix to $2a$', () => {
    expect(normalizeBcryptHashForVerify('$2y$10$abc')).toBe('$2a$10$abc');
  });
});
