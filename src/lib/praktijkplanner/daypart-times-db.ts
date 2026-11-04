import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { normaliseerTijd } from '@/lib/praktijkplanner/daypart-times';
import type { PraktijkplannerDaypartTime } from '@/types/praktijkplanner';

export async function loadDaypartTimes(
  idwaarneemgroep: number
): Promise<PraktijkplannerDaypartTime[]> {
  const rows = await db
    .select({
      iddagdeel: schema.praktijkplannerdagdeeltijden.iddagdeel,
      begintijd: schema.praktijkplannerdagdeeltijden.begintijd,
      eindtijd: schema.praktijkplannerdagdeeltijden.eindtijd,
    })
    .from(schema.praktijkplannerdagdeeltijden)
    .where(eq(schema.praktijkplannerdagdeeltijden.idwaarneemgroep, idwaarneemgroep))
    .orderBy(asc(schema.praktijkplannerdagdeeltijden.iddagdeel));

  return rows
    .map((row) => ({
      iddagdeel: row.iddagdeel,
      begintijd: normaliseerTijd(row.begintijd),
      eindtijd: normaliseerTijd(row.eindtijd),
    }))
    .filter((row) => row.begintijd !== '' && row.eindtijd !== '');
}

/**
 * Zet de tijden van een waarneemgroep, en gooit weg wat er niet meer bij staat.
 *
 * Eerst leeg en dan opnieuw vullen, net als bij de dagdelenmatrix. Er zijn er hooguit vier per
 * groep, dus het verschil uitrekenen zou meer code zijn dan het bespaart, en een dagdeel dat
 * uit de lijst verdwijnt hoort ook echt zijn tijd kwijt te raken.
 */
export async function replaceDaypartTimes(
  idwaarneemgroep: number,
  tijden: ReadonlyArray<PraktijkplannerDaypartTime>,
  updatedBy: number | null
): Promise<PraktijkplannerDaypartTime[]> {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.praktijkplannerdagdeeltijden)
      .where(eq(schema.praktijkplannerdagdeeltijden.idwaarneemgroep, idwaarneemgroep));

    if (tijden.length === 0) return;

    await tx.insert(schema.praktijkplannerdagdeeltijden).values(
      tijden.map((tijd) => ({
        idwaarneemgroep,
        iddagdeel: tijd.iddagdeel,
        begintijd: tijd.begintijd,
        eindtijd: tijd.eindtijd,
        updatedBy,
      }))
    );
  });

  return loadDaypartTimes(idwaarneemgroep);
}
