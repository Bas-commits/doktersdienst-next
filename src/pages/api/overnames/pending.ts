import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { alias } from 'drizzle-orm/pg-core';

const { diensten: dienstenTable, deelnemers } = schema;

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
 * Returns pending overname proposals for the logged-in doctor.
 * Used by the header popover to show notifications.
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

  // Aliases for joining sender and target doctor info
  const senderDeelnemer = alias(deelnemers, 'senderDeelnemer');
  const targetDeelnemer = alias(deelnemers, 'targetDeelnemer');

  const rows = await db
    .select({
      id: dienstenTable.id,
      van: dienstenTable.van,
      tot: dienstenTable.tot,
      senderId: dienstenTable.senderId,
      iddeelnovern: dienstenTable.iddeelnovern,
      senderVoornaam: senderDeelnemer.voornaam,
      senderAchternaam: senderDeelnemer.achternaam,
      targetVoornaam: targetDeelnemer.voornaam,
      targetAchternaam: targetDeelnemer.achternaam,
    })
    .from(dienstenTable)
    .leftJoin(senderDeelnemer, eq(dienstenTable.senderId, senderDeelnemer.id))
    .leftJoin(targetDeelnemer, eq(dienstenTable.iddeelnovern, targetDeelnemer.id))
    .where(
      and(
        eq(dienstenTable.type, 4),
        eq(dienstenTable.status, 'pending'),
        eq(dienstenTable.iddeelnovern, doctorId)
      )
    );

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

    const senderInitialen =
      ((r.senderVoornaam?.[0] ?? '') + (r.senderAchternaam?.[0] ?? '')).toUpperCase() || '??';
    const senderNaam = `${r.senderVoornaam ?? ''} ${r.senderAchternaam ?? ''}`.trim() || 'Onbekend';
    const targetInitialen =
      ((r.targetVoornaam?.[0] ?? '') + (r.targetAchternaam?.[0] ?? '')).toUpperCase() || '??';
    const targetNaam = `${r.targetVoornaam ?? ''} ${r.targetAchternaam ?? ''}`.trim() || 'Onbekend';

    return {
      id: r.id,
      datum,
      van: `${String(vanDate.getHours()).padStart(2, '0')}:${String(vanDate.getMinutes()).padStart(2, '0')}`,
      tot: `${String(totDate.getHours()).padStart(2, '0')}:${String(totDate.getMinutes()).padStart(2, '0')}`,
      week,
      vanArts: {
        initialen: senderInitialen,
        naam: senderNaam,
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
