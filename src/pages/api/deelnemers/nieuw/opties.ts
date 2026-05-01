import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { listGroepChoicesForNewDeelnemer, resolveDeelnemerCreatePermission } from '@/lib/deelnemer-nieuw';

export type DeelnemerNieuwGroepChoice = { id: number; naam: string | null };

export type DeelnemerNieuwOptiesResponse =
  | {
      allowed: true;
      groepen: DeelnemerNieuwGroepChoice[];
    }
  | {
      allowed: false;
      forbiddenReason: string;
      groepen: DeelnemerNieuwGroepChoice[];
    }
  | { error: string };

/**
 * GET /api/deelnemers/nieuw/opties — whether the caller may create a deelnemer + rol-opties voor het formulier.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<DeelnemerNieuwOptiesResponse>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const perm = await resolveDeelnemerCreatePermission(user);
    if (!perm.ok) {
      return res.status(200).json({ allowed: false, forbiddenReason: perm.forbiddenReason, groepen: [] });
    }
    const groepen = await listGroepChoicesForNewDeelnemer();
    return res.status(200).json({ allowed: true, groepen });
  } catch (err) {
    console.error('deelnemers/nieuw/opties error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
