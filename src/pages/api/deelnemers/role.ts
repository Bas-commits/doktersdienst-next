import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { normalizeRoleTier, type RoleTier } from '@/lib/roles';

type Data =
  | { isAdmin: boolean; idgroep: number | null; roleTier: RoleTier }
  | { error: string };

/**
 * GET /api/deelnemers/role
 *
 * Returns global role details for the current authenticated deelnemer.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(200).json({
    isAdmin: user.isAdmin,
    idgroep: user.idgroep,
    roleTier: normalizeRoleTier(user.idgroep),
  });
}
