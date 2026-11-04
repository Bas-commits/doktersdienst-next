import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedUser } from '@/lib/api-auth';
import {
  displayNameFromDeelnemer,
  getAccountStatusForUser,
  needsEmailOnboarding,
} from '@/lib/account-status';

type Data =
  | {
      needsEmailOnboarding: boolean;
      login: string | null;
      huisemail: string | null;
      email: string | null;
      displayName: string | null;
    }
  | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const row = await getAccountStatusForUser(user.id);
  if (!row) {
    return res.status(404).json({ error: 'Deelnemer niet gevonden' });
  }

  return res.status(200).json({
    needsEmailOnboarding: needsEmailOnboarding(row),
    login: row.login,
    huisemail: row.huisemail,
    email: row.email,
    displayName: displayNameFromDeelnemer(row),
  });
}
