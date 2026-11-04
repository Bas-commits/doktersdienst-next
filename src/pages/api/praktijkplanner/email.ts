import type { NextApiRequest, NextApiResponse } from 'next';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  canAccessPraktijkplannerParticipant,
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { isIsoDate, parsePositiveInteger } from '@/lib/praktijkplanner/dates';
import {
  sendPraktijkplannerPlanningAvailableEmailViaResend,
  sendPraktijkplannerScheduleEmailViaResend,
} from '@/lib/resend-email';

type Data = { success: true } | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const mode = body.mode === 'notify' ? 'notify' : 'schedule';
  const plannerType =
    body.plannerType === 'afwezigheden'
      ? 'afwezigheden'
      : body.plannerType === 'activiteiten'
        ? 'activiteiten'
        : null;
  const capability = plannerType === 'afwezigheden' ? 'afwezigheid:manage' : 'activiteiten:manage';
  const accessResult = await resolvePraktijkplannerAccess(req, body.idwaarneemgroep, capability);
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  const iddeelnemer = parsePositiveInteger(body.iddeelnemer);
  if (!iddeelnemer || !plannerType) {
    return res.status(400).json({ error: 'De e-mailgegevens zijn ongeldig.' });
  }
  if (
    !(await canAccessPraktijkplannerParticipant(accessResult.access, iddeelnemer, {
      requireManager: true,
    }))
  ) {
    return res.status(403).json({ error: 'Geen toegang tot deze deelnemer.' });
  }

  if (mode === 'notify') {
    if (plannerType !== 'activiteiten') {
      return res.status(400).json({ error: 'Meldingen zijn alleen beschikbaar voor activiteiten.' });
    }

    try {
      const [participant] = await db
        .select({
          login: schema.deelnemers.login,
          voornaam: schema.deelnemers.voornaam,
          achternaam: schema.deelnemers.achternaam,
          name: schema.deelnemers.name,
        })
        .from(schema.deelnemers)
        .where(eq(schema.deelnemers.id, iddeelnemer))
        .limit(1);
      const to = participant?.login?.trim();
      if (!to) {
        return res.status(400).json({ error: 'Deze deelnemer heeft geen login-e-mailadres.' });
      }
      const userName =
        [participant?.voornaam, participant?.achternaam].filter(Boolean).join(' ') ||
        participant?.name ||
        null;
      const subject = 'Nieuwe planning beschikbaar in Praktijkplanner';
      const { resendEmailId } = await sendPraktijkplannerPlanningAvailableEmailViaResend({
        to,
        userName,
      });
      await db.insert(schema.praktijkplanneremaillog).values({
        idwaarneemgroep: accessResult.access.idwaarneemgroep,
        iddeelnemer,
        type: 'activiteiten-notify',
        ontvanger: to,
        onderwerp: subject,
        resendId: resendEmailId,
        verstuurdDoor: accessResult.access.user.id,
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('[praktijkplanner/email]', error);
      return res.status(502).json({ error: 'De e-mail kon niet worden verstuurd.' });
    }
  }

  if (!isIsoDate(body.start) || !isIsoDate(body.end) || body.start > body.end) {
    return res.status(400).json({ error: 'De e-mailgegevens zijn ongeldig.' });
  }

  try {
    const [participant] = await db
      .select({
        email: schema.deelnemers.huisemail,
        fallbackEmail: schema.deelnemers.email,
        voornaam: schema.deelnemers.voornaam,
        achternaam: schema.deelnemers.achternaam,
        name: schema.deelnemers.name,
      })
      .from(schema.deelnemers)
      .where(eq(schema.deelnemers.id, iddeelnemer))
      .limit(1);
    const to = participant?.email?.trim() || participant?.fallbackEmail?.trim();
    if (!to) return res.status(400).json({ error: 'Deze deelnemer heeft geen e-mailadres.' });
    const userName =
      [participant?.voornaam, participant?.achternaam].filter(Boolean).join(' ') ||
      participant?.name ||
      null;

    let entries: Array<{
      datum: string;
      dagdeel: string;
      activiteit: string;
      locatie?: string | null;
      taken?: string[];
    }> = [];
    if (plannerType === 'activiteiten') {
      const rows = await db
        .select({
          datum: schema.planning.datum,
          dagdeel: schema.dagdelen.naam,
          activiteit: schema.activiteiten.naam,
          specificatie: schema.activiteitSpecificaties.naam,
          locatie: schema.praktijkplannerlocaties.naam,
        })
        .from(schema.planning)
        .leftJoin(schema.dagdelen, eq(schema.planning.iddagdeel, schema.dagdelen.id))
        .leftJoin(schema.activiteiten, eq(schema.planning.idactiviteit, schema.activiteiten.id))
        .leftJoin(
          schema.activiteitSpecificaties,
          eq(schema.planning.idactiviteitspecificatie, schema.activiteitSpecificaties.id)
        )
        .leftJoin(
          schema.praktijkplannerlocaties,
          eq(schema.planning.idplannerlocatie, schema.praktijkplannerlocaties.id)
        )
        .where(
          and(
            eq(schema.planning.idwaarneemgroep, accessResult.access.idwaarneemgroep),
            eq(schema.planning.iddeelnemer, iddeelnemer),
            gte(schema.planning.datum, body.start),
            lte(schema.planning.datum, body.end)
          )
        )
        .orderBy(asc(schema.planning.datum), asc(schema.dagdelen.volgorde));
      entries = rows
        .filter((row) => row.datum != null && row.dagdeel != null)
        .map((row) => ({
          datum: row.datum!,
          dagdeel: row.dagdeel!,
          activiteit: [row.activiteit, row.specificatie].filter(Boolean).join(' · ') || 'Geen activiteit',
          locatie: row.locatie,
        }));
    } else {
      const rows = await db
        .select({
          datum: schema.planningafwezigheden.datum,
          dagdeel: schema.dagdelen.naam,
          type: schema.afwezigheidstypen.naam,
          voorlopig: schema.planningafwezigheden.isVoorlopig,
        })
        .from(schema.planningafwezigheden)
        .innerJoin(schema.dagdelen, eq(schema.planningafwezigheden.iddagdeel, schema.dagdelen.id))
        .innerJoin(
          schema.afwezigheidstypen,
          eq(schema.planningafwezigheden.idafwezigheidstype, schema.afwezigheidstypen.id)
        )
        .where(
          and(
            eq(schema.planningafwezigheden.idwaarneemgroep, accessResult.access.idwaarneemgroep),
            eq(schema.planningafwezigheden.iddeelnemer, iddeelnemer),
            gte(schema.planningafwezigheden.datum, body.start),
            lte(schema.planningafwezigheden.datum, body.end)
          )
        )
        .orderBy(asc(schema.planningafwezigheden.datum), asc(schema.dagdelen.volgorde));
      entries = rows
        .filter((row) => row.datum != null && row.dagdeel != null && row.type != null)
        .map((row) => ({
          datum: row.datum!,
          dagdeel: row.dagdeel!,
          activiteit: `${row.type}${row.voorlopig ? ' (voorlopig)' : ''}`,
        }));
    }

    const subject =
      plannerType === 'activiteiten' ? 'Uw activiteitenplanning' : 'Uw afwezigheden';
    const { resendEmailId } = await sendPraktijkplannerScheduleEmailViaResend({
      to,
      subject,
      userName,
      plannerType,
      entries,
    });
    await db.insert(schema.praktijkplanneremaillog).values({
      idwaarneemgroep: accessResult.access.idwaarneemgroep,
      iddeelnemer,
      type: plannerType,
      ontvanger: to,
      onderwerp: subject,
      resendId: resendEmailId,
      verstuurdDoor: accessResult.access.user.id,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[praktijkplanner/email]', error);
    return res.status(502).json({ error: 'De e-mail kon niet worden verstuurd.' });
  }
}
