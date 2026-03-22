import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, inArray, ne, isNotNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { deelnemers, waarneemgroepen, waarneemgroepdeelnemers } = schema;

const GROEP_ADMINISTRATOR = 5;

export type DeelnemerWithGroepen = {
  id: number;
  voornaam: string | null;
  voorletterstussenvoegsel: string | null;
  achternaam: string | null;
  login: string | null;
  color: string | null;
  idgroep: number | null;
  waarneemgroepen: { id: number; naam: string | null; aangemeld: boolean }[];
};

type Data =
  | { deelnemers: DeelnemerWithGroepen[]; isAdmin: boolean; allWaarneemgroepen?: { id: number; naam: string | null }[] }
  | { error: string };

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

/**
 * GET /api/deelnemers
 *
 * Returns participants with their waarneemgroep memberships.
 * Admins (idgroep = 5) see all participants; non-admins see only participants in their own groups.
 * Optional query param: ?idwaarneemgroep=N (admin-only filter)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const email = session.user.email;
    if (!email) {
      return res.status(403).json({ error: 'No email on session' });
    }

    const [currentDeelnemer] = await db
      .select({ id: deelnemers.id, idgroep: deelnemers.idgroep })
      .from(deelnemers)
      .where(eq(deelnemers.email, email))
      .limit(1);

    if (!currentDeelnemer) {
      return res.status(403).json({ error: 'Deelnemer not found' });
    }

    const isAdmin = currentDeelnemer.idgroep === GROEP_ADMINISTRATOR;
    const filterWgId = req.query.idwaarneemgroep
      ? Number(req.query.idwaarneemgroep)
      : undefined;

    let targetDeelnemerIds: number[];

    if (isAdmin) {
      // Admin: get all participants with abonnementdd, optionally filtered by waarneemgroep
      if (filterWgId && !Number.isNaN(filterWgId)) {
        const rows = await db
          .select({ iddeelnemer: waarneemgroepdeelnemers.iddeelnemer })
          .from(waarneemgroepdeelnemers)
          .where(eq(waarneemgroepdeelnemers.idwaarneemgroep, filterWgId));
        targetDeelnemerIds = rows
          .map((r) => r.iddeelnemer)
          .filter((id): id is number => id !== null);
      } else {
        const rows = await db
          .select({ id: deelnemers.id })
          .from(deelnemers)
          .where(and(eq(deelnemers.abonnementdd, true)));
        targetDeelnemerIds = rows.map((r) => r.id).filter((id): id is number => id !== null);
      }
    } else {
      // Non-admin: get participants in same waarneemgroepen as current user
      const myMemberships = await db
        .select({ idwaarneemgroep: waarneemgroepdeelnemers.idwaarneemgroep })
        .from(waarneemgroepdeelnemers)
        .where(
          and(
            eq(waarneemgroepdeelnemers.iddeelnemer, currentDeelnemer.id),
            eq(waarneemgroepdeelnemers.aangemeld, true)
          )
        );
      const myWgIds = myMemberships
        .map((m) => m.idwaarneemgroep)
        .filter((id): id is number => id !== null);

      if (myWgIds.length === 0) {
        return res.status(200).json({ deelnemers: [], isAdmin });
      }

      const colleagues = await db
        .select({ iddeelnemer: waarneemgroepdeelnemers.iddeelnemer })
        .from(waarneemgroepdeelnemers)
        .where(
          and(
            inArray(waarneemgroepdeelnemers.idwaarneemgroep, myWgIds),
            eq(waarneemgroepdeelnemers.aangemeld, true)
          )
        );
      targetDeelnemerIds = [
        ...new Set(
          colleagues.map((c) => c.iddeelnemer).filter((id): id is number => id !== null)
        ),
      ];
    }

    if (targetDeelnemerIds.length === 0) {
      const response: Data = { deelnemers: [], isAdmin };
      if (isAdmin) {
        const allWg = await db
          .select({ id: waarneemgroepen.id, naam: waarneemgroepen.naam })
          .from(waarneemgroepen)
          .where(eq(waarneemgroepen.afgemeld, false));
        return res.status(200).json({
          ...response,
          allWaarneemgroepen: allWg.map((w) => ({ id: w.id ?? 0, naam: w.naam })),
        });
      }
      return res.status(200).json(response);
    }

    // Fetch deelnemers — match legacy getDoctorDataForGroup filters:
    // echtedeelnemer=1, afgemeld=0, abonnementdd=1, non-empty color
    const deelnemerRows = await db
      .select({
        id: deelnemers.id,
        voornaam: deelnemers.voornaam,
        voorletterstussenvoegsel: deelnemers.voorletterstussenvoegsel,
        achternaam: deelnemers.achternaam,
        login: deelnemers.login,
        color: deelnemers.color,
        idgroep: deelnemers.idgroep,
      })
      .from(deelnemers)
      .where(
        and(
          inArray(deelnemers.id, targetDeelnemerIds),
          eq(deelnemers.abonnementdd, true),
          eq(deelnemers.echtedeelnemer, true),
          eq(deelnemers.afgemeld, false),
          isNotNull(deelnemers.color),
          ne(deelnemers.color, ''),
          ne(deelnemers.color, ' '),
        )
      )
      .orderBy(deelnemers.achternaam, deelnemers.voornaam);

    // Fetch all waarneemgroep memberships for these deelnemers
    const memberships = await db
      .select({
        iddeelnemer: waarneemgroepdeelnemers.iddeelnemer,
        idwaarneemgroep: waarneemgroepdeelnemers.idwaarneemgroep,
        aangemeld: waarneemgroepdeelnemers.aangemeld,
        naam: waarneemgroepen.naam,
      })
      .from(waarneemgroepdeelnemers)
      .leftJoin(waarneemgroepen, eq(waarneemgroepdeelnemers.idwaarneemgroep, waarneemgroepen.id))
      .where(
        and(
          inArray(waarneemgroepdeelnemers.iddeelnemer, targetDeelnemerIds),
          eq(waarneemgroepdeelnemers.aangemeld, true)
        )
      );

    // Group memberships by deelnemer
    const membershipMap = new Map<number, { id: number; naam: string | null; aangemeld: boolean }[]>();
    for (const m of memberships) {
      if (m.iddeelnemer === null || m.idwaarneemgroep === null) continue;
      if (!membershipMap.has(m.iddeelnemer)) membershipMap.set(m.iddeelnemer, []);
      membershipMap.get(m.iddeelnemer)!.push({
        id: m.idwaarneemgroep,
        naam: m.naam,
        aangemeld: m.aangemeld ?? false,
      });
    }

    const result: DeelnemerWithGroepen[] = deelnemerRows.map((d) => ({
      id: d.id ?? 0,
      voornaam: d.voornaam,
      voorletterstussenvoegsel: d.voorletterstussenvoegsel,
      achternaam: d.achternaam,
      login: d.login,
      color: d.color,
      idgroep: d.idgroep,
      waarneemgroepen: membershipMap.get(d.id ?? 0) ?? [],
    }));

    const response: Data = { deelnemers: result, isAdmin };

    if (isAdmin) {
      const allWg = await db
        .select({ id: waarneemgroepen.id, naam: waarneemgroepen.naam })
        .from(waarneemgroepen)
        .where(eq(waarneemgroepen.afgemeld, false));
      return res.status(200).json({
        ...response,
        allWaarneemgroepen: allWg.map((w) => ({ id: w.id ?? 0, naam: w.naam })),
      });
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error('deelnemers API error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
