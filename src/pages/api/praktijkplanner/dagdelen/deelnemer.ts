import type { NextApiRequest, NextApiResponse } from 'next';
import {
  canAccessPraktijkplannerParticipant,
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { parsePositiveInteger } from '@/lib/praktijkplanner/dates';
import {
  isDaypartSchedulable,
  resolveParticipantMatrixForEditor,
  resolveSchedulableMatrixForEditor,
} from '@/lib/praktijkplanner/schedulable-dayparts';
import {
  allDaypartIds,
  loadSchedulableDayparts,
  replaceParticipantSchedulableDayparts,
} from '@/lib/praktijkplanner/schedulable-dayparts-db';
import type { PraktijkplannerParticipantSchedulableDaypart } from '@/types/praktijkplanner';

type Data =
  | { participantSchedulableDayparts: PraktijkplannerParticipantSchedulableDaypart[] }
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

  const iddeelnemer = parsePositiveInteger(body.iddeelnemer);
  if (!iddeelnemer) {
    return res.status(400).json({ error: 'Kies een geldige deelnemer.' });
  }
  if (!(await canAccessPraktijkplannerParticipant(accessResult.access, iddeelnemer))) {
    return res.status(403).json({ error: 'Deze deelnemer hoort niet bij deze waarneemgroep.' });
  }

  try {
    if (body.clear === true) {
      const cleared = await replaceParticipantSchedulableDayparts(
        accessResult.access.idwaarneemgroep,
        iddeelnemer,
        [],
        accessResult.access.user.id
      );
      return res.status(200).json({ participantSchedulableDayparts: cleared });
    }

    if (!Array.isArray(body.cells)) {
      return res.status(400).json({ error: 'De dagdelenmatrix is verplicht.' });
    }
    const daypartIds = await allDaypartIds();
    const daypartIdSet = new Set(daypartIds);
    const expectedSize = daypartIds.length * 7;
    if (body.cells.length !== expectedSize) {
      return res.status(400).json({
        error: `De dagdelenmatrix moet precies ${expectedSize} cellen bevatten.`,
      });
    }

    const parsed: Array<{ weekdag: number; iddagdeel: number; actief: boolean }> = [];
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

    const groupMatrix = await loadSchedulableDayparts(accessResult.access.idwaarneemgroep);
    const groupResolved = resolveSchedulableMatrixForEditor(groupMatrix, daypartIds);

    // Force participant cells off when the group does not allow that slot.
    const constrained = resolveParticipantMatrixForEditor(groupResolved, parsed, daypartIds).map(
      (cell) => ({
        ...cell,
        actief:
          cell.actief && isDaypartSchedulable(groupResolved, cell.weekdag, cell.iddagdeel),
      })
    );

    const saved = await replaceParticipantSchedulableDayparts(
      accessResult.access.idwaarneemgroep,
      iddeelnemer,
      constrained,
      accessResult.access.user.id
    );

    return res.status(200).json({ participantSchedulableDayparts: saved });
  } catch (error) {
    console.error('[praktijkplanner/dagdelen/deelnemer]', error);
    return res.status(500).json({ error: 'De deelnemer-dagdelen konden niet worden opgeslagen.' });
  }
}
