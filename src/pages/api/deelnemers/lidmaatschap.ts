import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, GROEP_ADMINISTRATOR, hasGroupManagementAccess } from '@/lib/api-auth';
import { deleteDeelnemerCompletely, isPgFkViolation } from '@/lib/deelnemer-delete';

const { deelnemers, waarneemgroepdeelnemers } = schema;

type Data = { ok: true; volledigVerwijderd: boolean } | { error: string };

/**
 * POST /api/deelnemers/lidmaatschap
 *
 * Deletes a waarneemgroepdeelnemers row for a specific deelnemer + waarneemgroep.
 * When it is the deelnemer's last membership, requires bevestigVolledigeVerwijdering
 * and removes the deelnemer from the entire system.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { iddeelnemer, idwaarneemgroep, bevestigVolledigeVerwijdering } = req.body as {
    iddeelnemer?: unknown;
    idwaarneemgroep?: unknown;
    bevestigVolledigeVerwijdering?: unknown;
  };

  if (
    typeof iddeelnemer !== 'number' ||
    !Number.isInteger(iddeelnemer) ||
    iddeelnemer <= 0 ||
    typeof idwaarneemgroep !== 'number' ||
    !Number.isInteger(idwaarneemgroep) ||
    idwaarneemgroep <= 0
  ) {
    return res.status(400).json({ error: 'Ongeldige parameters.' });
  }

  if (iddeelnemer === user.id) {
    return res.status(403).json({ error: 'U kunt uw eigen lidmaatschap niet verwijderen.' });
  }

  const hasAccess = await hasGroupManagementAccess(user, idwaarneemgroep);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Geen toegang om lidmaatschappen in deze waarneemgroep te beheren.' });
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

    const [membership] = await db
      .select({ id: waarneemgroepdeelnemers.id })
      .from(waarneemgroepdeelnemers)
      .where(
        and(
          eq(waarneemgroepdeelnemers.iddeelnemer, iddeelnemer),
          eq(waarneemgroepdeelnemers.idwaarneemgroep, idwaarneemgroep)
        )
      )
      .limit(1);

    if (!membership) {
      return res.status(404).json({ error: 'Lidmaatschap niet gevonden.' });
    }

    const allMemberships = await db
      .select({ id: waarneemgroepdeelnemers.id })
      .from(waarneemgroepdeelnemers)
      .where(eq(waarneemgroepdeelnemers.iddeelnemer, iddeelnemer));

    const membershipCount = allMemberships.length;

    if (membershipCount > 1) {
      await db
        .delete(waarneemgroepdeelnemers)
        .where(
          and(
            eq(waarneemgroepdeelnemers.iddeelnemer, iddeelnemer),
            eq(waarneemgroepdeelnemers.idwaarneemgroep, idwaarneemgroep)
          )
        );
      return res.status(200).json({ ok: true, volledigVerwijderd: false });
    }

    if (bevestigVolledigeVerwijdering !== true) {
      return res.status(400).json({
        error:
          'Dit is het laatste lidmaatschap. Bevestig volledige verwijdering om de deelnemer uit het systeem te verwijderen.',
      });
    }

    await db.transaction(async (tx) => {
      await deleteDeelnemerCompletely(tx, iddeelnemer, target.login);
    });

    return res.status(200).json({ ok: true, volledigVerwijderd: true });
  } catch (err) {
    console.error('deelnemers/lidmaatschap error', err);
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
