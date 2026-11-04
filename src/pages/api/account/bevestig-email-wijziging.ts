import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, ne } from 'drizzle-orm';
import { db, schema } from '@/db';
import { pool } from '@/lib/db';
import { verifyEmailChangeToken } from '@/lib/account-email-tokens';
import { auth } from '@/lib/auth';
import { toHeaders } from '@/lib/api-auth';

const { deelnemers } = schema;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tokenRaw = req.query.token;
  const token = typeof tokenRaw === 'string' ? tokenRaw.trim() : '';
  if (!token) {
    return res.redirect(302, '/login?emailChanged=invalid');
  }

  const payload = await verifyEmailChangeToken(token);
  if (!payload) {
    return res.redirect(302, '/login?emailChanged=invalid');
  }

  const { userId, newEmail } = payload;

  const [target] = await db
    .select({
      id: deelnemers.id,
      login: deelnemers.login,
      emailVerified: deelnemers.emailVerified,
    })
    .from(deelnemers)
    .where(eq(deelnemers.id, userId))
    .limit(1);

  if (!target?.id) {
    return res.redirect(302, '/login?emailChanged=invalid');
  }

  const currentLogin = (target.login || '').trim().toLowerCase();
  if (currentLogin === newEmail) {
    await auth.api.signOut({ headers: toHeaders(req.headers) }).catch(() => undefined);
    return res.redirect(302, '/login?emailChanged=ok');
  }

  const [dupe] = await db
    .select({ id: deelnemers.id })
    .from(deelnemers)
    .where(and(eq(deelnemers.login, newEmail), ne(deelnemers.id, userId)))
    .limit(1);
  if (dupe) {
    return res.redirect(302, '/login?emailChanged=taken');
  }

  await db
    .update(deelnemers)
    .set({
      login: newEmail,
      email: newEmail,
      huisemail: newEmail,
      emailVerified: true,
    })
    .where(eq(deelnemers.id, userId));

  const accountId = `credential-${userId}`;
  await pool.query(`UPDATE account SET "updatedAt" = now() WHERE id = $1`, [accountId]).catch(() => undefined);

  await auth.api.signOut({ headers: toHeaders(req.headers) }).catch(() => undefined);

  return res.redirect(302, '/login?emailChanged=ok');
}
