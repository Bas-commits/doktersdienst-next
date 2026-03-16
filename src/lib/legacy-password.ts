import { createHash } from 'crypto';

const LEGACY_SALT = 'dDd';

/**
 * Legacy PHP-style password hash: strtoupper(md5(salt + password)).
 * Used only for verifying existing deelnemers; new passwords should use secure hashing.
 */
export function legacyMD5Hash(password: string): string {
  return createHash('md5').update(LEGACY_SALT + password).digest('hex').toUpperCase();
}

/**
 * Verify a plain password against the stored legacy hash from deelnemers.encrypted_password.
 */
export function legacyMD5Verify(storedHash: string | null | undefined, password: string): boolean {
  if (storedHash == null || storedHash === '' || password == null) return false;
  const computed = legacyMD5Hash(password);
  return computed.length === 32 && storedHash.length === 32 && computed === storedHash;
}
