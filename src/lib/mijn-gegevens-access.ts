import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { GROEP_SECRETARIS, type AuthenticatedUser } from '@/lib/api-auth';

const { waarneemgroepdeelnemers } = schema;

/**
 * Admin can edit everyone. Secretaris can edit participants in their active secretaris groups.
 */
export async function hasDelegatedProfileAccess(
  actor: AuthenticatedUser,
  targetDeelnemerId: number
): Promise<boolean> {
  if (actor.isAdmin) return true;

  const actorSecretarisRows = await db
    .select({ idwaarneemgroep: waarneemgroepdeelnemers.idwaarneemgroep })
    .from(waarneemgroepdeelnemers)
    .where(
      and(
        eq(waarneemgroepdeelnemers.iddeelnemer, actor.id),
        eq(waarneemgroepdeelnemers.idgroep, GROEP_SECRETARIS),
        eq(waarneemgroepdeelnemers.aangemeld, true)
      )
    );

  const actorSecretarisGroupIds = actorSecretarisRows
    .map((r) => r.idwaarneemgroep)
    .filter((id): id is number => id !== null);

  if (actorSecretarisGroupIds.length === 0) return false;

  const [targetMembership] = await db
    .select({ id: waarneemgroepdeelnemers.id })
    .from(waarneemgroepdeelnemers)
    .where(
      and(
        eq(waarneemgroepdeelnemers.iddeelnemer, targetDeelnemerId),
        eq(waarneemgroepdeelnemers.aangemeld, true),
        inArray(waarneemgroepdeelnemers.idwaarneemgroep, actorSecretarisGroupIds)
      )
    )
    .limit(1);

  return !!targetMembership;
}
