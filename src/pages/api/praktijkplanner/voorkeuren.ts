import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';

type Data =
  | { toonDag: boolean; toonNacht: boolean; toonWeekend: boolean; toonDiensten: boolean }
  | { success: true }
  | { error: string };

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
          toonWeekend: schema.praktijkplannerweergavevoorkeuren.toonWeekend,
          toonDiensten: schema.praktijkplannerweergavevoorkeuren.toonDiensten,
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
        // Zonder rij staat de knop uit: avond en nacht verschijnen dan vanzelf zodra er iets
        // in staat, en blijven anders weg. Dat is het gedrag dat de meeste weken wil.
        toonNacht: preference?.toonNacht ?? false,
        // Zonder rij staat het weekend er gewoon. Alleen wie het wegklikt heeft een mening.
        toonWeekend: preference?.toonWeekend ?? true,
        // Zonder rij staat de knop uit, net als toonNacht: diensten in een dagdeel of dag die
        // toch al verborgen is, komen dan niet vanzelf mee.
        toonDiensten: preference?.toonDiensten ?? false,
      });
    } catch (error) {
      console.error('[praktijkplanner/voorkeuren GET]', error);
      return res.status(500).json({ error: 'De weergavevoorkeuren konden niet worden geladen.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /*
    Elk veld op zichzelf, want de knoppen zitten in verschillende schermonderdelen. Zou een
    POST altijd alle velden moeten meesturen, dan schrijft de knop voor het weekend de stand
    van de andere knoppen mee terug zoals hij die toevallig kende, en zet hij die terug zodra
    ze niet gelijk liepen.
  */
  const body = (req.body ?? {}) as Record<string, unknown>;
  const velden = ['toonDag', 'toonNacht', 'toonWeekend', 'toonDiensten'] as const;
  if (velden.some((veld) => body[veld] !== undefined && typeof body[veld] !== 'boolean')) {
    return res.status(400).json({ error: 'De weergavevoorkeuren zijn ongeldig.' });
  }
  const gevraagd = Object.fromEntries(
    velden.filter((veld) => typeof body[veld] === 'boolean').map((veld) => [veld, body[veld]])
  ) as Partial<Record<(typeof velden)[number], boolean>>;
  if (Object.keys(gevraagd).length === 0) {
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
          ...gevraagd,
          updatedAt: new Date().toISOString(),
        })
        .where(where);
    } else {
      // Wat niet meekomt krijgt de standaard uit het schema, niet de waarde die de
      // aanroeper niet noemde.
      await db.insert(schema.praktijkplannerweergavevoorkeuren).values({
        iddeelnemer: accessResult.access.user.id,
        idwaarneemgroep: accessResult.access.idwaarneemgroep,
        ...gevraagd,
      });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[praktijkplanner/voorkeuren POST]', error);
    return res.status(500).json({ error: 'De weergavevoorkeuren konden niet worden opgeslagen.' });
  }
}
