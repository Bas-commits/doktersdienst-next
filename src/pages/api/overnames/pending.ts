import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { alias } from 'drizzle-orm/pg-core';

const { diensten: dienstenTable, deelnemers, waarneemgroepdeelnemers } = schema;
const GROEP_SECRETARIS = 2;

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

/**
 * GET /api/overnames/pending
 *
 * Returns pending overname proposals visible to the logged-in doctor.
 * - Regular doctors see proposals targeted at them (iddeelnovern = self).
 * - Secretaris users also see all proposals in their waarneemgroepen.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get the logged-in doctor's deelnemer ID
  const currentDoctor = await db
    .select({ id: deelnemers.id })
    .from(deelnemers)
    .where(eq(deelnemers.login, session.user.email))
    .limit(1);

  if (!currentDoctor.length) {
    return res.status(200).json({ verzoeken: [] });
  }

  const doctorId = currentDoctor[0].id;

  // Find waarneemgroepen where this doctor is secretaris
  const secretarisGroepen = await db
    .select({ idwaarneemgroep: waarneemgroepdeelnemers.idwaarneemgroep })
    .from(waarneemgroepdeelnemers)
    .where(
      and(
        eq(waarneemgroepdeelnemers.iddeelnemer, doctorId),
        eq(waarneemgroepdeelnemers.idgroep, GROEP_SECRETARIS)
      )
    );
  const secretarisWgIds = secretarisGroepen
    .map((r) => r.idwaarneemgroep)
    .filter((id): id is number => id != null);

  // Build filter: proposals targeting me OR proposals in my secretaris waarneemgroepen
  const targetFilter = eq(dienstenTable.iddeelnovern, sql`${doctorId}::integer`);
  const pendingFilter = and(
    eq(dienstenTable.type, 4),
    eq(dienstenTable.status, 'pending'),
    secretarisWgIds.length > 0
      ? or(targetFilter, inArray(dienstenTable.idwaarneemgroep, secretarisWgIds))
      : targetFilter
  );

  // Aliases for joining original (van) and target (naar) doctor info
  // "van arts" = the doctor whose shift is being taken over (iddeelnemer on the proposal)
  // "naar arts" = the target doctor who would take over (iddeelnovern)
  const originalDeelnemer = alias(deelnemers, 'originalDeelnemer');
  const targetDeelnemer = alias(deelnemers, 'targetDeelnemer');

  const rows = await db
    .select({
      iddienstovern: dienstenTable.iddienstovern,
      van: dienstenTable.van,
      tot: dienstenTable.tot,
      iddeelnemer: dienstenTable.iddeelnemer,
      iddeelnovern: dienstenTable.iddeelnovern,
      originalVoornaam: originalDeelnemer.voornaam,
      originalAchternaam: originalDeelnemer.achternaam,
      targetVoornaam: targetDeelnemer.voornaam,
      targetAchternaam: targetDeelnemer.achternaam,
    })
    .from(dienstenTable)
    .leftJoin(originalDeelnemer, eq(dienstenTable.iddeelnemer, originalDeelnemer.id))
    .leftJoin(targetDeelnemer, eq(dienstenTable.iddeelnovern, targetDeelnemer.id))
    .where(pendingFilter);

  const verzoeken = rows.map((r) => {
    const vanDate = new Date(Number(r.van ?? 0) * 1000);
    const totDate = new Date(Number(r.tot ?? 0) * 1000);
    const datum = vanDate.toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    // ISO week number
    const d = new Date(vanDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week = Math.round(
      (d.getTime() - new Date(d.getFullYear(), 0, 4).getTime()) / 86400000 / 7 + 1
    );

    const originalInitialen =
      ((r.originalVoornaam?.[0] ?? '') + (r.originalAchternaam?.[0] ?? '')).toUpperCase() || '??';
    const originalNaam = `${r.originalVoornaam ?? ''} ${r.originalAchternaam ?? ''}`.trim() || 'Onbekend';
    const targetInitialen =
      ((r.targetVoornaam?.[0] ?? '') + (r.targetAchternaam?.[0] ?? '')).toUpperCase() || '??';
    const targetNaam = `${r.targetVoornaam ?? ''} ${r.targetAchternaam ?? ''}`.trim() || 'Onbekend';

    return {
      iddienstovern: r.iddienstovern,
      datum,
      van: `${String(vanDate.getHours()).padStart(2, '0')}:${String(vanDate.getMinutes()).padStart(2, '0')}`,
      tot: `${String(totDate.getHours()).padStart(2, '0')}:${String(totDate.getMinutes()).padStart(2, '0')}`,
      week,
      vanArts: {
        initialen: originalInitialen,
        naam: originalNaam,
        akkoord: true,
      },
      naarArts: {
        initialen: targetInitialen,
        naam: targetNaam,
        akkoord: false,
      },
    };
  });

  return res.status(200).json({ verzoeken });
}
