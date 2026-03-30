import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, lt, gt, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';

type Data = { success: true; message: string } | { error: string };

/** Parse "YYYY-MM-DD HH:MM:SS" local datetime string to Unix seconds. */
function parseLocalDateTime(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6])
  );
  if (isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

/**
 * POST /api/diensten/create
 *
 * Body: { van, tot, idwaarneemgroep, idaantekening?, idtarief?, nieuweaant?,
 *         herhalen?, weken?, startdatum?, einddatum? }
 *
 * Creates one or more type=1 (unassigned slot) diensten.
 * For recurring shifts, inserts a dienstherhalen record and repeats every `weken` weeks.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  const vanStr = body?.van;
  const totStr = body?.tot;
  const idwaarneemgroep = Number(body?.idwaarneemgroep);
  const idaantekening = body?.idaantekening != null ? Number(body.idaantekening) : 0;
  const idtarief = body?.idtarief != null ? Number(body.idtarief) : 0;
  const nieuweaant = typeof body?.nieuweaant === 'string' ? body.nieuweaant.trim() : '';
  const herhalen = body?.herhalen === true;
  const weken = herhalen ? Math.max(1, Math.min(52, Number(body?.weken) || 1)) : 1;
  const startdatum = herhalen ? Number(body?.startdatum) : NaN;
  const einddatum = herhalen ? Number(body?.einddatum) : NaN;

  if (!vanStr || !totStr) {
    return res.status(400).json({ error: 'Van en Tot zijn verplicht.' });
  }

  const vanUnix = parseLocalDateTime(vanStr);
  const totUnix = parseLocalDateTime(totStr);

  if (vanUnix === null || totUnix === null) {
    return res.status(400).json({ error: 'Ongeldige datum/tijd formaat. Gebruik YYYY-MM-DD HH:MM:SS.' });
  }
  if (totUnix <= vanUnix) {
    return res.status(400).json({ error: 'Het einde van de shift moet na het begin liggen.' });
  }
  if (Number.isNaN(idwaarneemgroep) || idwaarneemgroep <= 0) {
    return res.status(400).json({ error: 'Geen waarneemgroep geselecteerd.' });
  }

  const hasAccess = await hasGroupManagementAccess(user, idwaarneemgroep);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Geen toegang tot deze waarneemgroep.' });
  }
  if (herhalen && (Number.isNaN(startdatum) || Number.isNaN(einddatum) || einddatum <= startdatum)) {
    return res.status(400).json({ error: 'Ongeldige startdatum of einddatum voor herhaling.' });
  }

  const { diensten: dienstenTable, dienstaantekening, dienstherhalen } = schema;
  const duration = totUnix - vanUnix;

  try {
    // Handle new annotation
    let effectiveAantekeningId = idaantekening;
    if (nieuweaant) {
      const maxResult = await db
        .select({ maxId: sql<number>`max(id)` })
        .from(dienstaantekening);
      const newId = (Number(maxResult[0]?.maxId) || 0) + 1;
      await db.insert(dienstaantekening).values({
        id: newId,
        tekst: nieuweaant.slice(0, 25),
        idwaarneemgroep,
        idtariefDefault: idtarief > 0 ? idtarief : null,
        verwijderd: false,
      });
      effectiveAantekeningId = newId;
    }

    if (!herhalen) {
      // Check for overlapping type=1 slots
      const conflicts = await db
        .select({ id: dienstenTable.id })
        .from(dienstenTable)
        .where(
          and(
            eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
            eq(dienstenTable.type, 1),
            lt(dienstenTable.van, totUnix),
            gt(dienstenTable.tot, vanUnix)
          )
        )
        .limit(1);

      if (conflicts.length > 0) {
        return res.status(409).json({ error: 'Er is al een overlappende shift in deze waarneemgroep.' });
      }

      await db.insert(dienstenTable).values({
        van: vanUnix,
        tot: totUnix,
        idwaarneemgroep,
        iddeelnemer: 0,
        type: 1,
        ...(effectiveAantekeningId > 0 && { idaantekening: effectiveAantekeningId }),
        ...(idtarief > 0 && { idtarief }),
      });

      return res.status(200).json({ success: true, message: 'Shift toegevoegd.' });
    }

    // Recurring: build list of van/tot pairs
    const stepSecs = weken * 7 * 24 * 3600;
    let cursor = vanUnix;

    // Walk backward to find earliest occurrence within range
    while (cursor - stepSecs >= startdatum) {
      cursor -= stepSecs;
    }

    const slots: { van: number; tot: number }[] = [];
    while (cursor <= einddatum) {
      if (cursor >= startdatum) {
        slots.push({ van: cursor, tot: cursor + duration });
      }
      cursor += stepSecs;
    }

    if (slots.length === 0) {
      return res.status(400).json({ error: 'Geen shifts gevonden in het opgegeven datumbereik.' });
    }

    // Check for overlapping type=1 slots across entire series
    for (const slot of slots) {
      const conflicts = await db
        .select({ id: dienstenTable.id })
        .from(dienstenTable)
        .where(
          and(
            eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
            eq(dienstenTable.type, 1),
            lt(dienstenTable.van, slot.tot),
            gt(dienstenTable.tot, slot.van)
          )
        )
        .limit(1);

      if (conflicts.length > 0) {
        return res.status(409).json({
          error: `Er is al een overlappende shift voor ${new Date(slot.van * 1000).toLocaleDateString('nl-NL')}.`,
        });
      }
    }

    // Insert dienstherhalen record
    const [herhalenRow] = await db
      .insert(dienstherhalen)
      .values({ weken, startdatum, einddatum })
      .returning({ id: dienstherhalen.id });

    const iddienstherhalen = herhalenRow?.id ?? null;

    // Bulk insert all slots
    await db.insert(dienstenTable).values(
      slots.map((slot) => ({
        van: slot.van,
        tot: slot.tot,
        idwaarneemgroep,
        iddeelnemer: 0,
        type: 1,
        ...(iddienstherhalen != null && { iddienstherhalen }),
        ...(effectiveAantekeningId > 0 && { idaantekening: effectiveAantekeningId }),
        ...(idtarief > 0 && { idtarief }),
      }))
    );

    return res.status(200).json({
      success: true,
      message: `${slots.length} shift${slots.length !== 1 ? 's' : ''} toegevoegd.`,
    });
  } catch (err) {
    console.error('[api/diensten/create]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
