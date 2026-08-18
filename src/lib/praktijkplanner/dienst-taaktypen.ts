import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';

/**
 * De taaktypen van een waarneemgroep die als dienst zijn aangemerkt.
 *
 * Twee regels steunen hierop en het zijn allebei uitzonderingen op iets dat verder hard is:
 * een dienst mag op een dagdeel waarop de arts niet werkt, en herhalen en een week kopieren
 * laten een dienst staan. Leegmaken haalt hem wel weg.
 *
 * Verwijderde taaktypen blijven erbuiten, maar planning die nog naar zo'n taak wijst wordt er
 * wel door gedekt: de bescherming hoort te gelden zolang de rij er is, niet zolang de taak in
 * het keuzemenu staat.
 */
export async function dienstTaaktypeIds(idwaarneemgroep: number): Promise<Set<number>> {
  const rows = await db
    .select({ id: schema.taaktypen.id })
    .from(schema.taaktypen)
    .where(
      and(
        eq(schema.taaktypen.idwaarneemgroep, idwaarneemgroep),
        eq(schema.taaktypen.isDienst, true)
      )
    );
  return new Set(rows.flatMap((row) => (row.id == null ? [] : [row.id])));
}
