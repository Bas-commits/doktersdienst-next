import type { NextApiResponse } from 'next';
import { PASSWORD_UPGRADED_MARKER } from '@/lib/account-password-upgrade';
import { pool as appPool } from '@/lib/db';
import { requestPasswordResetSilently } from '@/lib/auth-invite-followup';

export async function invalidateLegacyCredentials(userId: string): Promise<void> {
  const client = await appPool.connect();
  try {
    await client.query('SET search_path TO public');
    await client.query(
      `UPDATE public.deelnemers
       SET encrypted_password = NULL,
           password = CASE WHEN password = $2 THEN password ELSE NULL END
       WHERE id = $1::int`,
      [userId, PASSWORD_UPGRADED_MARKER]
    );
    await client.query(
      `UPDATE public.account SET password = NULL, "updatedAt" = now() WHERE "userId" = $1`,
      [userId]
    );
  } finally {
    client.release();
  }
}

export async function redirectToInvitePasswordSetup(
  res: NextApiResponse,
  userId: string,
  email: string
): Promise<void> {
  const token = await requestPasswordResetSilently(email);
  await invalidateLegacyCredentials(userId);
  const q = new URLSearchParams({
    token,
    email: email.toLowerCase(),
    setup: 'invite',
  });
  res.redirect(302, `/reset-password?${q.toString()}`);
}
