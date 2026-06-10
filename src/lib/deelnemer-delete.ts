import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';

const { deelnemers, waarneemgroepdeelnemers } = schema;

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function isPgFkViolation(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code?: string }).code === '23503';
  }
  return false;
}

/**
 * Removes all waarneemgroepdeelnemers, auth session/account (and matching auth_verification),
 * then deletes the deelnemer row. Must run inside a transaction.
 */
export async function deleteDeelnemerCompletely(
  tx: Transaction,
  iddeelnemer: number,
  login: string | null | undefined
): Promise<void> {
  const userIdText = String(iddeelnemer);
  const loginTrim = login?.trim() ?? '';

  await tx.delete(waarneemgroepdeelnemers).where(eq(waarneemgroepdeelnemers.iddeelnemer, iddeelnemer));
  await tx.execute(sql`DELETE FROM session WHERE "userId" = ${userIdText}`);
  await tx.execute(sql`DELETE FROM account WHERE "userId" = ${userIdText}`);
  if (loginTrim) {
    await tx.execute(
      sql`DELETE FROM auth_verification WHERE LOWER(TRIM(identifier)) = LOWER(${loginTrim})`
    );
  }
  await tx.delete(deelnemers).where(eq(deelnemers.id, iddeelnemer));
}
