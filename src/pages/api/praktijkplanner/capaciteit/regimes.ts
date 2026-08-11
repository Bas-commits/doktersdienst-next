import type { NextApiRequest, NextApiResponse } from 'next';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { isIsoDate, parsePositiveInteger, startOfIsoWeek, weekRangeLabel } from '@/lib/praktijkplanner/dates';
import type { PraktijkplannerCapacityRegime } from '@/types/praktijkplanner';

type Data = { regimes: PraktijkplannerCapacityRegime[] } | { error: string };

const NAAM_MAX = 60;
const WEKEN_MAX = 60;

function oneQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseNaam(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const naam = value.trim();
  if (naam.length === 0 || naam.length > NAAM_MAX) return null;
  return naam;
}

/**
 * De opgegeven weken als maandagen, of null als er iets niet klopt.
 *
 * Een datum ergens in de week wordt naar de maandag geschoven in plaats van geweigerd. De
 * database eist een maandag, en het scherm laat een week kiezen, niet een dag; een datum
 * halverwege de week is dus geen fout van de gebruiker maar een vraag om die week.
 */
function parseWeken(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > WEKEN_MAX) return null;
  const maandagen = new Set<string>();
  for (const item of value) {
    if (!isIsoDate(item)) return null;
    maandagen.add(startOfIsoWeek(item));
  }
  return [...maandagen].sort();
}

async function loadRegimes(idwaarneemgroep: number): Promise<PraktijkplannerCapacityRegime[]> {
  const regimes = await db
    .select({ id: schema.capaciteitsregimes.id, naam: schema.capaciteitsregimes.naam })
    .from(schema.capaciteitsregimes)
    .where(eq(schema.capaciteitsregimes.idwaarneemgroep, idwaarneemgroep))
    .orderBy(asc(schema.capaciteitsregimes.naam));

  const ids = regimes.map((regime) => regime.id).filter((id): id is number => id != null);
  if (ids.length === 0) return [];

  const weken = await db
    .select({
      idregime: schema.capaciteitsregimeweken.idregime,
      maandag: schema.capaciteitsregimeweken.maandag,
    })
    .from(schema.capaciteitsregimeweken)
    .where(inArray(schema.capaciteitsregimeweken.idregime, ids))
    .orderBy(asc(schema.capaciteitsregimeweken.maandag));

  const wekenByRegime = new Map<number, string[]>();
  for (const week of weken) {
    if (week.idregime == null || week.maandag == null) continue;
    const list = wekenByRegime.get(week.idregime) ?? [];
    list.push(week.maandag);
    wekenByRegime.set(week.idregime, list);
  }

  return regimes
    .filter((regime): regime is typeof regime & { id: number; naam: string } =>
      regime.id != null && regime.naam != null
    )
    .map((regime) => ({
      id: regime.id,
      naam: regime.naam,
      weken: wekenByRegime.get(regime.id) ?? [],
    }));
}

async function regimeInGroup(idregime: number, idwaarneemgroep: number): Promise<boolean> {
  const [regime] = await db
    .select({ id: schema.capaciteitsregimes.id })
    .from(schema.capaciteitsregimes)
    .where(
      and(
        eq(schema.capaciteitsregimes.id, idregime),
        eq(schema.capaciteitsregimes.idwaarneemgroep, idwaarneemgroep)
      )
    )
    .limit(1);
  return regime?.id != null;
}

/**
 * De week die al aan een ander regime hangt, of null als ze allemaal vrij zijn.
 *
 * De primaire sleutel op (waarneemgroep, maandag) weigert dit ook, maar dan als 23505 zonder
 * te zeggen welke week het is. Vooraf kijken kost een query en levert een melding op waar de
 * secretaris iets mee kan.
 */
async function bezetteWeek(
  idwaarneemgroep: number,
  idregime: number,
  maandagen: string[]
): Promise<{ maandag: string; naam: string } | null> {
  if (maandagen.length === 0) return null;
  const rows = await db
    .select({
      maandag: schema.capaciteitsregimeweken.maandag,
      idregime: schema.capaciteitsregimeweken.idregime,
      naam: schema.capaciteitsregimes.naam,
    })
    .from(schema.capaciteitsregimeweken)
    .innerJoin(
      schema.capaciteitsregimes,
      eq(schema.capaciteitsregimeweken.idregime, schema.capaciteitsregimes.id)
    )
    .where(
      and(
        eq(schema.capaciteitsregimeweken.idwaarneemgroep, idwaarneemgroep),
        inArray(schema.capaciteitsregimeweken.maandag, maandagen)
      )
    );

  for (const row of rows) {
    if (row.idregime === idregime || row.maandag == null || row.naam == null) continue;
    return { maandag: row.maandag, naam: row.naam };
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const isRead = req.method === 'GET';
  const body = (req.body ?? {}) as Record<string, unknown>;
  const accessResult = await resolvePraktijkplannerAccess(
    req,
    isRead ? oneQueryValue(req.query.idwaarneemgroep) : body.idwaarneemgroep,
    isRead ? 'capaciteit:read' : 'capaciteit:manage'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);
  const { idwaarneemgroep } = accessResult.access;
  const updatedBy = accessResult.access.user.id;

  try {
    if (isRead) {
      return res.status(200).json({ regimes: await loadRegimes(idwaarneemgroep) });
    }

    if (req.method === 'POST') {
      const naam = parseNaam(body.naam);
      if (!naam) return res.status(400).json({ error: `Geef een naam van maximaal ${NAAM_MAX} tekens.` });
      const bestaat = await db
        .select({ id: schema.capaciteitsregimes.id })
        .from(schema.capaciteitsregimes)
        .where(
          and(
            eq(schema.capaciteitsregimes.idwaarneemgroep, idwaarneemgroep),
            eq(schema.capaciteitsregimes.naam, naam)
          )
        )
        .limit(1);
      if (bestaat[0]?.id != null) {
        return res.status(400).json({ error: `Er is al een regime dat ${naam} heet.` });
      }
      await db
        .insert(schema.capaciteitsregimes)
        .values({ idwaarneemgroep, naam, updatedBy, updatedAt: new Date().toISOString() });
      return res.status(200).json({ regimes: await loadRegimes(idwaarneemgroep) });
    }

    if (req.method === 'PUT') {
      const idregime = parsePositiveInteger(body.idregime);
      if (!idregime || !(await regimeInGroup(idregime, idwaarneemgroep))) {
        return res.status(400).json({ error: 'Dit regime bestaat niet.' });
      }
      const naam = body.naam === undefined ? null : parseNaam(body.naam);
      if (body.naam !== undefined && !naam) {
        return res.status(400).json({ error: `Geef een naam van maximaal ${NAAM_MAX} tekens.` });
      }
      const weken = body.weken === undefined ? null : parseWeken(body.weken);
      if (body.weken !== undefined && !weken) {
        return res.status(400).json({ error: `Kies geldige weken, maximaal ${WEKEN_MAX} stuks.` });
      }
      if (weken) {
        const bezet = await bezetteWeek(idwaarneemgroep, idregime, weken);
        if (bezet) {
          return res.status(400).json({
            error: `De week van ${weekRangeLabel(bezet.maandag, { withYear: true })} hoort al bij ${bezet.naam}.`,
          });
        }
      }

      const updatedAt = new Date().toISOString();
      await db.transaction(async (tx) => {
        if (naam) {
          await tx
            .update(schema.capaciteitsregimes)
            .set({ naam, updatedBy, updatedAt })
            .where(eq(schema.capaciteitsregimes.id, idregime));
        }
        if (!weken) return;
        // De hele lijst wordt vervangen, want het scherm stuurt de weken die moeten gelden.
        await tx
          .delete(schema.capaciteitsregimeweken)
          .where(eq(schema.capaciteitsregimeweken.idregime, idregime));
        if (weken.length === 0) return;
        await tx.insert(schema.capaciteitsregimeweken).values(
          weken.map((maandag) => ({ idwaarneemgroep, idregime, maandag, updatedBy, updatedAt }))
        );
      });
      return res.status(200).json({ regimes: await loadRegimes(idwaarneemgroep) });
    }

    if (req.method === 'DELETE') {
      const idregime = parsePositiveInteger(body.idregime);
      if (!idregime || !(await regimeInGroup(idregime, idwaarneemgroep))) {
        return res.status(400).json({ error: 'Dit regime bestaat niet.' });
      }
      // De weken en de sjablonen van dit regime gaan mee via ON DELETE CASCADE. De normale
      // week staat los, met idregime leeg, en blijft dus staan.
      await db.delete(schema.capaciteitsregimes).where(eq(schema.capaciteitsregimes.id, idregime));
      return res.status(200).json({ regimes: await loadRegimes(idwaarneemgroep) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[praktijkplanner/capaciteit/regimes]', error);
    return res.status(500).json({ error: 'De regimes konden niet worden opgeslagen.' });
  }
}
