import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { db, schema } from '@/db';
import { deelnemerRoepnaam } from '@/lib/deelnemer-display';
import { normalizeRoleTier, type RoleTier } from '@/lib/roles';

const { deelnemers } = schema;

type Data =
  | {
      isAdmin: boolean;
      idgroep: number | null;
      roleTier: RoleTier;
      displayName: string;
      initialen: string | null;
    }
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

  const [profile] = await db
    .select({
      name: deelnemers.name,
      voornaam: deelnemers.voornaam,
      voorletterstussenvoegsel: deelnemers.voorletterstussenvoegsel,
      achternaam: deelnemers.achternaam,
      initialen: deelnemers.initialen,
    })
    .from(deelnemers)
    .where(eq(deelnemers.id, user.id))
    .limit(1);

  const displayName = deelnemerRoepnaam(profile ?? {}) ?? user.email;

  return res.status(200).json({
    isAdmin: user.isAdmin,
    idgroep: user.idgroep,
    roleTier: normalizeRoleTier(user.idgroep),
    displayName,
    initialen: profile?.initialen?.trim() || null,
  });
}
