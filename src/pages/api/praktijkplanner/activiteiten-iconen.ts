import type { NextApiRequest, NextApiResponse } from 'next';
import {
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { listActiviteitenIconen } from '@/lib/praktijkplanner/activiteiten-iconen.server';

type Data = { icons: string[] } | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessResult = await resolvePraktijkplannerAccess(
    req,
    req.query.idwaarneemgroep,
    'beheer:manage'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  return res.status(200).json({ icons: listActiviteitenIconen() });
}
