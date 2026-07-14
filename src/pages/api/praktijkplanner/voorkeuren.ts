import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';

type Data = { toonDag: boolean; toonNacht: boolean } | { success: true } | { error: string };

function oneQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const idwaarneemgroep =
    req.method === 'GET'
      ? oneQueryValue(req.query.idwaarneemgroep)
      : (req.body as Record<string, unknown> | undefined)?.idwaarneemgroep;
  const accessResult = await resolvePraktijkplannerAccess(
    req,
    idwaarneemgroep,
    'activiteiten:read'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  if (req.method === 'GET') {
    try {
      const [preference] = await db
        .select({
          toonDag: schema.praktijkplannerweergavevoorkeuren.toonDag,
          toonNacht: schema.praktijkplannerweergavevoorkeuren.toonNacht,
        })
        .from(schema.praktijkplannerweergavevoorkeuren)
        .where(
          and(
            eq(schema.praktijkplannerweergavevoorkeuren.iddeelnemer, accessResult.access.user.id),
            eq(
              schema.praktijkplannerweergavevoorkeuren.idwaarneemgroep,
              accessResult.access.idwaarneemgroep
            )
          )
        )
        .limit(1);
      return res.status(200).json({
        toonDag: preference?.toonDag ?? true,
        toonNacht: preference?.toonNacht ?? true,
      });
    } catch (error) {
      console.error('[praktijkplanner/voorkeuren GET]', error);
      return res.status(500).json({ error: 'De weergavevoorkeuren konden niet worden geladen.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body.toonDag !== 'boolean' || typeof body.toonNacht !== 'boolean') {
    return res.status(400).json({ error: 'De weergavevoorkeuren zijn ongeldig.' });
  }

  try {
    const where = and(
      eq(schema.praktijkplannerweergavevoorkeuren.iddeelnemer, accessResult.access.user.id),
      eq(
        schema.praktijkplannerweergavevoorkeuren.idwaarneemgroep,
        accessResult.access.idwaarneemgroep
      )
    );
    const [existing] = await db
      .select({ iddeelnemer: schema.praktijkplannerweergavevoorkeuren.iddeelnemer })
      .from(schema.praktijkplannerweergavevoorkeuren)
      .where(where)
      .limit(1);
    if (existing) {
      await db
        .update(schema.praktijkplannerweergavevoorkeuren)
        .set({
          toonDag: body.toonDag,
          toonNacht: body.toonNacht,
          updatedAt: new Date().toISOString(),
        })
        .where(where);
    } else {
      await db.insert(schema.praktijkplannerweergavevoorkeuren).values({
        iddeelnemer: accessResult.access.user.id,
        idwaarneemgroep: accessResult.access.idwaarneemgroep,
        toonDag: body.toonDag,
        toonNacht: body.toonNacht,
      });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[praktijkplanner/voorkeuren POST]', error);
    return res.status(500).json({ error: 'De weergavevoorkeuren konden niet worden opgeslagen.' });
  }
}
