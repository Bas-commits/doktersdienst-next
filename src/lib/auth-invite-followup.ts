import { auth } from '@/lib/auth';
import { getBetterAuthApiBase } from '@/lib/better-auth-url';
import { syntheticSignUpTrustHeaders } from '@/lib/deelnemer-nieuw';
import { pool as appPool } from '@/lib/db';

/**
 * Na succesvol verifiëren: als er nog geen legacy-hash op deelnemer staat, wordt de
 * officiële wachtwoord‑reset‑flow getriggers (zelfde als “wachtwoord vergeten”).
 * Bestaande accounts met encrypted_password worden overgeslagen.
 */
export async function maybeRequestPasswordSetupAfterVerification(
  email: string | null | undefined
): Promise<void> {
  if (!email?.trim()) return;
  const e = email.trim().toLowerCase();

  const client = await appPool.connect();
  try {
    await client.query('SET search_path TO public');
    const r = await client.query<{ pwd: string | null; ev: boolean | null }>(
      'SELECT encrypted_password AS pwd, email_verified AS ev FROM deelnemers WHERE login = $1 LIMIT 1',
      [e]
    );
    const row = r.rows?.[0];
    if (!row || row.ev !== true) return;
    const hasLegacyHash = !!(row.pwd && String(row.pwd).trim() !== '');
    if (hasLegacyHash) return;
  } finally {
    client.release();
  }

  const siteOrigin = new URL(getBetterAuthApiBase()).origin;

  await auth.api.requestPasswordReset({
    body: {
      email: e,
      redirectTo: `${siteOrigin}/reset-password`,
    },
    headers: syntheticSignUpTrustHeaders(),
  });
}
