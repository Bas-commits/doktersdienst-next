import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { schema } from '@/db';
import type { OvernameSectie } from '@/lib/overname-sectie';

const { diensten: dienstenTable } = schema;

/** SQL condition matching overname rows of exactly this lane (NULL for the middle lane). */
export function overnameSectieCondition(sectie: OvernameSectie | null): SQL {
  return sectie === null
    ? isNull(dienstenTable.overnameSectie)
    : eq(dienstenTable.overnameSectie, sectie);
}

export type LegacyOvernameLookupFields = {
  idwaarneemgroep: number;
  van: number;
  tot: number;
  /** When set (including 0), matches `iddienstovern` exactly — used by respond for legacy rows. */
  iddienstovern?: number;
  iddeelnemer?: number | null;
  iddeelnovern?: number | null;
  /**
   * When present (including `null` = middle lane), only matches overnames of that lane. The same
   * doctor can hold the dienst and the achterwacht of one slot, so without this an achterwacht
   * proposal and a dienst proposal on the same van/tot would be taken for each other. Leave it
   * `undefined` for callers that do not know about lanes (mobile), which keeps the old behaviour.
   */
  overnameSectie?: OvernameSectie | null;
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
  if (fields.overnameSectie !== undefined) {
    conditions.push(overnameSectieCondition(fields.overnameSectie));
  }

  return and(...conditions)!;
}
