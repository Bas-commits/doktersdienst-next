import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedUser, toHeaders } from '@/lib/api-auth';
import { redirectToInvitePasswordSetup } from '@/lib/account-password-setup';
import { isPendingPasswordSetup } from '@/lib/account-password-upgrade';
import { getAccountStatusForUser } from '@/lib/account-status';
import { auth } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  const user = await getAuthenticatedUser(req);
  if (!session?.user || !user) {
    return res.redirect(302, '/login?callbackUrl=/account/wachtwoord-instellen');
  }

  const row = await getAccountStatusForUser(user.id);
  if (!row) {
    return res.redirect(302, '/login?invite=user_missing');
  }
  if (!isPendingPasswordSetup(row.password)) {
    return res.redirect(302, '/rooster-inzien');
  }

  const email = (session.user.email || row.login || '').trim().toLowerCase();
  if (!email.includes('@')) {
    return res.redirect(302, '/login?invite=invalid');
  }

  try {
    await redirectToInvitePasswordSetup(res, String(user.id), email);
  } catch (err) {
    console.error('account/wachtwoord-instellen error', err);
    return res.redirect(302, '/login?invite=error');
  }
}
