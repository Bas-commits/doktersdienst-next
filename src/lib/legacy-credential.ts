import { compareSync } from 'bcryptjs';
import {
  isPasswordSetupMarker,
  PASSWORD_UPGRADED_MARKER,
} from '@/lib/account-password-upgrade';
import { legacyMD5Verify } from '@/lib/legacy-password';

export function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$.+/.test(hash);
}

/** PHP bcrypt uses $2y$; Node bcryptjs expects $2a$ for the same hash body. */
export function normalizeBcryptHashForVerify(hash: string): string {
  if (hash.startsWith('$2y$')) {
    return `$2a$${hash.slice(4)}`;
  }
  return hash;
}

export type DeelnemerCredentialRow = {
  encrypted_password: string | null;
  password: string | null;
};

/**
 * Resolves the hash Better Auth should use for credential verification.
 * Legacy data may live in encrypted_password (MD5) or password (PHP bcrypt).
 */
export function resolveStoredCredentialHash(row: DeelnemerCredentialRow): string | null {
  const md5 = row.encrypted_password?.trim();
  if (md5) return md5;

  const pwd = row.password?.trim();
  if (!pwd || isPasswordSetupMarker(pwd)) return null;
  if (isBcryptHash(pwd)) return pwd;
  return null;
}

export function hasStoredCredential(row: DeelnemerCredentialRow): boolean {
  return resolveStoredCredentialHash(row) != null;
}

export async function verifyStoredCredentialHash(
  hash: string,
  plainPassword: string
): Promise<boolean> {
  if (isBcryptHash(hash)) {
    try {
      return compareSync(plainPassword, normalizeBcryptHashForVerify(hash));
    } catch {
      return false;
    }
  }
  return legacyMD5Verify(hash, plainPassword);
}
