import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getPraktijkplannerParticipants,
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { getPraktijkplannerMasterData } from '@/lib/praktijkplanner/master-data';

type Data =
  | {
      idwaarneemgroep: number;
      userId: number;
      isManager: boolean;
      isAdmin: boolean;
      participants: Awaited<ReturnType<typeof getPraktijkplannerParticipants>>;
      masterData: Awaited<ReturnType<typeof getPraktijkplannerMasterData>>;
    }
  | { error: string };

/** Provides the selected group context needed by all Praktijkplanner screens. */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessResult = await resolvePraktijkplannerAccess(
    req,
    req.query.idwaarneemgroep,
    'activiteiten:read'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  try {
    const { access } = accessResult;
    const [participants, masterData] = await Promise.all([
      getPraktijkplannerParticipants(access),
      getPraktijkplannerMasterData(access.idwaarneemgroep),
    ]);

    return res.status(200).json({
      idwaarneemgroep: access.idwaarneemgroep,
      userId: access.user.id,
      isManager: access.isManager,
      isAdmin: access.user.isAdmin,
      participants,
      masterData,
    });
  } catch (error) {
    console.error('[praktijkplanner/context]', error);
    return res.status(500).json({ error: 'De plannercontext kon niet worden geladen.' });
  }
}
