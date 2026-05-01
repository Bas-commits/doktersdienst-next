import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, GROEP_ADMINISTRATOR } from '@/lib/api-auth';

const { deelnemers, waarneemgroepdeelnemers } = schema;

type Data = { ok: true } | { error: string };

function isPgFkViolation(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code?: string }).code === '23503';
  }
  return false;
}

/**
 * POST /api/deelnemers/verwijderen
 *
 * Admin only. Removes all waarneemgroepdeelnemers for the deelnemer, auth session/account
 * (and matching auth_verification), then deletes the deelnemer row.
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
  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Alleen beheerders mogen deelnemers verwijderen.' });
  }

  const { iddeelnemer } = req.body as { iddeelnemer?: unknown };
  if (typeof iddeelnemer !== 'number' || !Number.isInteger(iddeelnemer) || iddeelnemer <= 0) {
    return res.status(400).json({ error: 'Ongeldig iddeelnemer.' });
  }

  if (iddeelnemer === user.id) {
    return res.status(403).json({ error: 'U kunt uw eigen account niet verwijderen.' });
  }

  try {
    const [target] = await db
      .select({ id: deelnemers.id, login: deelnemers.login, idgroep: deelnemers.idgroep })
      .from(deelnemers)
      .where(eq(deelnemers.id, iddeelnemer))
      .limit(1);

    if (!target?.id) {
      return res.status(404).json({ error: 'Deelnemer niet gevonden.' });
    }

    if (target.idgroep === GROEP_ADMINISTRATOR) {
      return res.status(403).json({
        error: 'Verwijderen van een andere beheerder is niet toegestaan.',
      });
    }

    const [stillAangemeld] = await db
      .select({ id: waarneemgroepdeelnemers.id })
      .from(waarneemgroepdeelnemers)
      .where(
        and(
          eq(waarneemgroepdeelnemers.iddeelnemer, iddeelnemer),
          eq(waarneemgroepdeelnemers.aangemeld, true)
        )
      )
      .limit(1);

    if (stillAangemeld) {
      return res.status(409).json({
        error:
          'Deelnemer is nog aangemeld bij een of meer waarneemgroepen. Meld eerst overal af voordat u verwijdert.',
      });
    }

    const userIdText = String(iddeelnemer);
    const loginTrim = target.login?.trim() ?? '';

    await db.transaction(async (tx) => {
      await tx.delete(waarneemgroepdeelnemers).where(eq(waarneemgroepdeelnemers.iddeelnemer, iddeelnemer));
      await tx.execute(sql`DELETE FROM session WHERE "userId" = ${userIdText}`);
      await tx.execute(sql`DELETE FROM account WHERE "userId" = ${userIdText}`);
      if (loginTrim) {
        await tx.execute(
          sql`DELETE FROM auth_verification WHERE LOWER(TRIM(identifier)) = LOWER(${loginTrim})`
        );
      }
      await tx.delete(deelnemers).where(eq(deelnemers.id, iddeelnemer));
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('deelnemers/verwijderen error', err);
    if (isPgFkViolation(err)) {
      return res.status(409).json({
        error:
          'Deze deelnemer kan niet worden verwijderd omdat er nog gerelateerde gegevens in de database staan.',
      });
    }
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Interne fout',
    });
  }
}
