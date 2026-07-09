import { and, eq, type SQL } from 'drizzle-orm';
import { schema } from '@/db';

const { diensten: dienstenTable } = schema;

export type LegacyOvernameLookupFields = {
  idwaarneemgroep: number;
  van: number;
  tot: number;
  /** When set (including 0), matches `iddienstovern` exactly — used by respond for legacy rows. */
  iddienstovern?: number;
  iddeelnemer?: number | null;
  iddeelnovern?: number | null;
};

/**
 * Composite lookup for overname rows when `iddienstovern` and/or `id` are missing (legacy PHP data).
 * Shared by propose (duplicate detection) and respond (accept/decline/delete) so web and mobile
 * resolve the same row with identical van/tot/idwaarneemgroep keys.
 */
export function buildLegacyOvernameRowConditions(
  fields: LegacyOvernameLookupFields,
): SQL {
  const conditions: SQL[] = [];

  if (fields.iddienstovern !== undefined) {
    conditions.push(eq(dienstenTable.iddienstovern, fields.iddienstovern));
  }
  conditions.push(
    eq(dienstenTable.idwaarneemgroep, fields.idwaarneemgroep),
    eq(dienstenTable.van, fields.van),
    eq(dienstenTable.tot, fields.tot),
  );

  if (fields.iddeelnemer != null && fields.iddeelnemer > 0) {
    conditions.push(eq(dienstenTable.iddeelnemer, fields.iddeelnemer));
  }
  if (fields.iddeelnovern != null && fields.iddeelnovern > 0) {
    conditions.push(eq(dienstenTable.iddeelnovern, fields.iddeelnovern));
  }

  return and(...conditions)!;
}
