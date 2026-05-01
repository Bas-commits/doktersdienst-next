import type { NextApiRequest, NextApiResponse } from 'next';
import { toHeaders } from '@/lib/api-auth';
import { requestPasswordResetSilently } from '@/lib/auth-invite-followup';
import { auth } from '@/lib/auth';
import { pool as appPool } from '@/lib/db';

/**
 * Na e-mailverificatie (invite): sessie staat al; mint een reset-token zonder tweede mail
 * en stuur de gebruiker door naar het wachtwoordformulier.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  const emailRaw = session?.user?.email?.trim();
  const userId = session?.user?.id != null ? String(session.user.id) : null;

  if (!userId || !emailRaw) {
    return res.redirect(302, '/login?invite=session_required');
  }

  const email = emailRaw.toLowerCase();

  const client = await appPool.connect();
  try {
    await client.query('SET search_path TO public');
    const r = await client.query<{
      id: number;
      encrypted_password: string | null;
      email_verified: boolean | null;
    }>(
      'SELECT id, encrypted_password, email_verified FROM deelnemers WHERE id = $1::int LIMIT 1',
      [userId]
    );
    const row = r.rows[0];
    if (!row) {
      return res.redirect(302, '/login?invite=user_missing');
    }
    if (String(row.id) !== userId) {
      return res.redirect(302, '/login?invite=invalid');
    }
    if (row.email_verified !== true) {
      return res.redirect(302, '/login?invite=not_verified');
    }
    const hasPwd = !!(row.encrypted_password && String(row.encrypted_password).trim() !== '');
    if (hasPwd) {
      return res.redirect(302, '/');
    }

    const token = await requestPasswordResetSilently(email);
    const q = new URLSearchParams({
      token,
      email,
      setup: 'invite',
    });
    return res.redirect(302, `/reset-password?${q.toString()}`);
  } catch (err) {
    console.error('invite na-verificatie error', err);
    return res.redirect(302, '/login?invite=error');
  } finally {
    client.release();
  }
}
