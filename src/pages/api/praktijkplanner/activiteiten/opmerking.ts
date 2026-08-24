import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  canAccessPraktijkplannerParticipant,
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { isIsoDate, parsePositiveInteger } from '@/lib/praktijkplanner/dates';

type Data = { success: true; slotIds: number[] } | { error: string };

/**
 * De opmerking die een planner bij een fiche zet.
 *
 * Een eigen endpoint en geen veld op het opslaan van een dagdeel. Die twee horen bij
 * verschillende handelingen: een dagdeel samenstellen gaat over wat er staat, een opmerking
 * over wat de planner erbij te melden heeft. Ze samenvoegen zou betekenen dat elke klik op
 * een dagdeel de opmerking mee moet sturen om hem niet kwijt te raken.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Methode niet toegestaan.' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const accessResult = await resolvePraktijkplannerAccess(
    req,
    body.idwaarneemgroep,
    'activiteiten:manage'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  const iddeelnemer = parsePositiveInteger(body.iddeelnemer);
  const iddagdeel = parsePositiveInteger(body.iddagdeel);
  const datum = body.datum;
  if (iddeelnemer == null || iddagdeel == null || !isIsoDate(datum)) {
    return res.status(400).json({ error: 'Deelnemer, datum en dagdeel zijn verplicht.' });
  }
  if (
    !(await canAccessPraktijkplannerParticipant(accessResult.access, iddeelnemer, {
      requireManager: true,
    }))
  ) {
    return res.status(403).json({ error: 'Geen toegang tot deze deelnemer.' });
  }

  if (body.opmerking != null && typeof body.opmerking !== 'string') {
    return res.status(400).json({ error: 'De opmerking moet tekst zijn.' });
  }
  // Leeg is hetzelfde als niets: de kolom gaat op null en het paperclipje verdwijnt.
  const opmerking = typeof body.opmerking === 'string' ? body.opmerking.trim() : '';
  const waarde = opmerking === '' ? null : opmerking;
  const voorHeleHerhaling = body.voorHeleHerhaling === true;

  const [slot] = await db
    .select({ id: schema.planning.id })
    .from(schema.planning)
    .where(
      and(
        eq(schema.planning.idwaarneemgroep, accessResult.access.idwaarneemgroep),
        eq(schema.planning.iddeelnemer, iddeelnemer),
        eq(schema.planning.datum, datum),
        eq(schema.planning.iddagdeel, iddagdeel)
      )
    )
    .limit(1);
  if (!slot) {
    return res.status(404).json({ error: 'Er staat niets op dit dagdeel.' });
  }

  const slotIds = await db.transaction(async (tx) => {
    let doelen = [slot.id];
    if (voorHeleHerhaling) {
      const [link] = await tx
        .select({ idherhaling: schema.planningherhalingslots.idherhaling })
        .from(schema.planningherhalingslots)
        .where(eq(schema.planningherhalingslots.idplanning, slot.id))
        .limit(1);
      if (link?.idherhaling != null) {
        /*
          Elke fiche van de reeks krijgt dezelfde tekst. De reeks staat als losse
          planningsregels in de database, dus er is geen plek waar de opmerking een keer kan
          staan; hem overal neerzetten is wat "voor de hele herhaling" hier betekent.
        */
        const reeks = await tx
          .select({ idplanning: schema.planningherhalingslots.idplanning })
          .from(schema.planningherhalingslots)
          .where(eq(schema.planningherhalingslots.idherhaling, link.idherhaling));
        doelen = reeks.map((rij) => rij.idplanning);
      }
    }

    /*
      Een opmerking maakt van een fiche in een herhaling geen afwijking. Het gele bordje gaat
      over planning die anders is dan de reeks; een opmerking verandert daar niets aan, en het
      bordje zou dan iets melden wat de lezer niet terugvindt in de fiche.
    */
    await tx
      .update(schema.planning)
      .set({ opmerking: waarde, updatedBy: accessResult.access.user.id })
      .where(inArray(schema.planning.id, doelen));
    return doelen;
  });

  return res.status(200).json({ success: true, slotIds });
}
