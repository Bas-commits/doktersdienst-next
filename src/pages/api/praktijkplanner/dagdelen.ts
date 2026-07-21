import type { NextApiRequest, NextApiResponse } from 'next';
import {
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { parsePositiveInteger } from '@/lib/praktijkplanner/dates';
import {
  allDaypartIds,
  replaceSchedulableDayparts,
} from '@/lib/praktijkplanner/schedulable-dayparts-db';
import { resolveSchedulableMatrixForEditor } from '@/lib/praktijkplanner/schedulable-dayparts';
import type { PraktijkplannerSchedulableDaypart } from '@/types/praktijkplanner';

type Data =
  | { schedulableDayparts: PraktijkplannerSchedulableDaypart[] }
  | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const accessResult = await resolvePraktijkplannerAccess(
    req,
    body.idwaarneemgroep,
    'beheer:manage'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  if (!Array.isArray(body.cells)) {
    return res.status(400).json({ error: 'De dagdelenmatrix is verplicht.' });
  }

  try {
    const daypartIds = await allDaypartIds();
    const daypartIdSet = new Set(daypartIds);
    const expectedSize = daypartIds.length * 7;

    if (body.cells.length !== expectedSize) {
      return res.status(400).json({
        error: `De dagdelenmatrix moet precies ${expectedSize} cellen bevatten.`,
      });
    }

    const parsed: PraktijkplannerSchedulableDaypart[] = [];
    const seen = new Set<string>();

    for (const raw of body.cells) {
      const input = raw as {
        weekdag?: unknown;
        iddagdeel?: unknown;
        actief?: unknown;
      };
      const weekdag = Number(input.weekdag);
      const iddagdeel = parsePositiveInteger(input.iddagdeel);
      if (
        !Number.isInteger(weekdag) ||
        weekdag < 1 ||
        weekdag > 7 ||
        !iddagdeel ||
        !daypartIdSet.has(iddagdeel) ||
        typeof input.actief !== 'boolean'
      ) {
        return res.status(400).json({ error: 'Een dagdeelcel bevat ongeldige gegevens.' });
      }
      const key = `${weekdag}:${iddagdeel}`;
      if (seen.has(key)) {
        return res.status(400).json({ error: 'Een dagdeelcel komt dubbel voor.' });
      }
      seen.add(key);
      parsed.push({ weekdag, iddagdeel, actief: input.actief });
    }

    // Ensure every weekday × daypart combination is present.
    const complete = resolveSchedulableMatrixForEditor(parsed, daypartIds);
    if (complete.length !== expectedSize) {
      return res.status(400).json({ error: 'De dagdelenmatrix is incompleet.' });
    }

    const saved = await replaceSchedulableDayparts(
      accessResult.access.idwaarneemgroep,
      complete,
      accessResult.access.user.id
    );

    return res.status(200).json({ schedulableDayparts: saved });
  } catch (error) {
    console.error('[praktijkplanner/dagdelen]', error);
    return res.status(500).json({ error: 'De dagdelen konden niet worden opgeslagen.' });
  }
}
