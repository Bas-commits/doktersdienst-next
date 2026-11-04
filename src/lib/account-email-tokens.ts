import { signJWT, verifyJWT } from 'better-auth/crypto';

export const EMAIL_VERIFICATION_TTL_SEC = 3600;
export const EMAIL_CHANGE_TTL_SEC = 3600;

export function getAuthSecret(): string | null {
  const s = process.env.BETTER_AUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  return s || null;
}

export function normalizeAccountEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidAccountEmail(raw: string): boolean {
  const t = raw.trim();
  return t.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export async function signOnboardingVerificationToken(email: string): Promise<string> {
  const secret = getAuthSecret();
  if (!secret) throw new Error('Auth secret missing');
  return signJWT({ email: normalizeAccountEmail(email) }, secret, EMAIL_VERIFICATION_TTL_SEC);
}

export async function signEmailChangeToken(userId: number, newEmail: string): Promise<string> {
  const secret = getAuthSecret();
  if (!secret) throw new Error('Auth secret missing');
  return signJWT(
    {
      userId,
      newEmail: normalizeAccountEmail(newEmail),
      purpose: 'email_change',
    },
    secret,
    EMAIL_CHANGE_TTL_SEC
  );
}

export async function verifyEmailChangeToken(
  token: string
): Promise<{ userId: number; newEmail: string } | null> {
  const secret = getAuthSecret();
  if (!secret) return null;
  const payload = await verifyJWT(token, secret);
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (p.purpose !== 'email_change') return null;
  const userId = typeof p.userId === 'number' ? p.userId : Number(p.userId);
  const newEmail = typeof p.newEmail === 'string' ? normalizeAccountEmail(p.newEmail) : '';
  if (!Number.isFinite(userId) || userId < 1 || !newEmail || !isValidAccountEmail(newEmail)) {
    return null;
  }
  return { userId, newEmail };
}
