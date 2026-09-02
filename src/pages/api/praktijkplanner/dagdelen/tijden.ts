import type { NextApiRequest, NextApiResponse } from 'next';
import {
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { parsePositiveInteger } from '@/lib/praktijkplanner/dates';
import { normaliseerTijd } from '@/lib/praktijkplanner/daypart-times';
import { replaceDaypartTimes } from '@/lib/praktijkplanner/daypart-times-db';
import { allDaypartIds } from '@/lib/praktijkplanner/schedulable-dayparts-db';
import type { PraktijkplannerDaypartTime } from '@/types/praktijkplanner';

type Data = { daypartTimes: PraktijkplannerDaypartTime[] } | { error: string };

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

  if (!Array.isArray(body.times)) {
    return res.status(400).json({ error: 'De dagdeeltijden zijn verplicht.' });
  }

  try {
    const daypartIds = new Set(await allDaypartIds());
    const parsed: PraktijkplannerDaypartTime[] = [];
    const gezien = new Set<number>();

    for (const raw of body.times) {
      const input = raw as { iddagdeel?: unknown; begintijd?: unknown; eindtijd?: unknown };
      const iddagdeel = parsePositiveInteger(input.iddagdeel);
      const begintijd = normaliseerTijd(input.begintijd);
      const eindtijd = normaliseerTijd(input.eindtijd);

      if (!iddagdeel || !daypartIds.has(iddagdeel) || !begintijd || !eindtijd) {
        return res.status(400).json({ error: 'Een dagdeeltijd bevat ongeldige gegevens.' });
      }
      if (gezien.has(iddagdeel)) {
        return res.status(400).json({ error: 'Een dagdeel komt dubbel voor.' });
      }
      /*
        Begintijd na eindtijd wordt niet geweigerd: de nacht loopt van 23:00 tot 07:00 en gaat
        dus over middernacht heen. Alleen precies gelijk kan niet, want dat is een dagdeel van
        nul minuten.
      */
      if (begintijd === eindtijd) {
        return res.status(400).json({ error: 'Begin- en eindtijd mogen niet gelijk zijn.' });
      }

      gezien.add(iddagdeel);
      parsed.push({ iddagdeel, begintijd, eindtijd });
    }

    const saved = await replaceDaypartTimes(
      accessResult.access.idwaarneemgroep,
      parsed,
      accessResult.access.user.id
    );

    return res.status(200).json({ daypartTimes: saved });
  } catch (error) {
    console.error('[praktijkplanner/dagdelen/tijden]', error);
    return res.status(500).json({ error: 'De dagdeeltijden konden niet worden opgeslagen.' });
  }
}
