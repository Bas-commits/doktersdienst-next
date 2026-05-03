import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedUser } from '@/lib/api-auth';

type Data = { isAdmin: boolean } | { error: string };

/**
 * GET /api/deelnemers/role
 *
 * Returns whether the current user is a global administrator (lightweight helper for UI flags).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(200).json({ isAdmin: user.isAdmin });
}
