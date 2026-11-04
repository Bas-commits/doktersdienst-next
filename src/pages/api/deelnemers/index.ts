import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, inArray, ne, isNotNull } from 'drizzle-orm';
import { findDeelnemerBySessionEmail } from '@/lib/api-auth';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { deelnemers, waarneemgroepen, waarneemgroepdeelnemers } = schema;

const GROEP_ADMINISTRATOR = 5;

export type DeelnemerWithGroepen = {
  id: number;
  voornaam: string | null;
  voorletterstussenvoegsel: string | null;
  achternaam: string | null;
  initialen: string | null;
  login: string | null;
  color: string | null;
  idgroep: number | null;
  emailVerified: boolean | null;
  echtedeelnemer: boolean | null;
  waarneemgroepen: {
    id: number;
    naam: string | null;
    aangemeld: boolean;
    idgroep: number | null;
    idfunctie: number | null;
  }[];
  /** Total waarneemgroepdeelnemers rows (beheer mode only). */
  membershipCount?: number;
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
 * Optional query params:
 *   ?idwaarneemgroep=N — admins filter vrij; niet-admins alleen eigen lidmaatschappen.
 *   ?beheer=1 — deelnemersbeheer: alle leden tonen (incl. echtedeelnemer=false, zonder kleur).
 *               Standaard (rooster/overnames): alleen inroosterbare deelnemers.
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

    const currentDeelnemer = await findDeelnemerBySessionEmail(email);

    if (!currentDeelnemer) {
      return res.status(403).json({ error: 'Deelnemer not found' });
    }

    const isAdmin = currentDeelnemer.idgroep === GROEP_ADMINISTRATOR;
    const filterWgId = req.query.idwaarneemgroep
      ? Number(req.query.idwaarneemgroep)
      : undefined;
    const beheerMode = req.query.beheer === '1' || req.query.beheer === 'true';

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

      let wgIdsScope = myWgIds;
      if (filterWgId !== undefined && !Number.isNaN(filterWgId)) {
        if (!myWgIds.includes(filterWgId)) {
          return res.status(403).json({ error: 'Geen toegang tot deze waarneemgroep.' });
        }
        wgIdsScope = [filterWgId];
      }

      const colleagueFilters = [inArray(waarneemgroepdeelnemers.idwaarneemgroep, wgIdsScope)];
      if (!beheerMode) {
        colleagueFilters.push(eq(waarneemgroepdeelnemers.aangemeld, true));
      }
      const colleagues = await db
        .select({ iddeelnemer: waarneemgroepdeelnemers.iddeelnemer })
        .from(waarneemgroepdeelnemers)
        .where(and(...colleagueFilters));
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

    // Rooster: legacy getDoctorDataForGroup filters (echtedeelnemer, kleur).
    // Beheer: alle actieve abonnees in de groep, zodat echtedeelnemer/kleur te wijzigen zijn.
    const deelnemerFilters = [
      inArray(deelnemers.id, targetDeelnemerIds),
      eq(deelnemers.abonnementdd, true),
      eq(deelnemers.afgemeld, false),
    ];
    if (!beheerMode) {
      deelnemerFilters.push(
        eq(deelnemers.echtedeelnemer, true),
        isNotNull(deelnemers.color),
        ne(deelnemers.color, ''),
        ne(deelnemers.color, ' '),
      );
    }

    const deelnemerRows = await db
      .select({
        id: deelnemers.id,
        voornaam: deelnemers.voornaam,
        voorletterstussenvoegsel: deelnemers.voorletterstussenvoegsel,
        achternaam: deelnemers.achternaam,
        initialen: deelnemers.initialen,
        login: deelnemers.login,
        color: deelnemers.color,
        idgroep: deelnemers.idgroep,
        emailVerified: deelnemers.emailVerified,
        echtedeelnemer: deelnemers.echtedeelnemer,
      })
      .from(deelnemers)
      .where(and(...deelnemerFilters))
      .orderBy(deelnemers.achternaam, deelnemers.voornaam);

    const deelnemerIdsForQuery = deelnemerRows
      .map((d) => d.id)
      .filter((id): id is number => id !== null);

    const membershipFilters = [inArray(waarneemgroepdeelnemers.iddeelnemer, deelnemerIdsForQuery)];
    if (!beheerMode) {
      membershipFilters.push(eq(waarneemgroepdeelnemers.aangemeld, true));
    }

    // Fetch waarneemgroep memberships for these deelnemers
    const memberships = await db
      .select({
        iddeelnemer: waarneemgroepdeelnemers.iddeelnemer,
        idwaarneemgroep: waarneemgroepdeelnemers.idwaarneemgroep,
        aangemeld: waarneemgroepdeelnemers.aangemeld,
        idgroep: waarneemgroepdeelnemers.idgroep,
        idfunctie: waarneemgroepdeelnemers.idfunctie,
        naam: waarneemgroepen.naam,
      })
      .from(waarneemgroepdeelnemers)
      .leftJoin(waarneemgroepen, eq(waarneemgroepdeelnemers.idwaarneemgroep, waarneemgroepen.id))
      .where(and(...membershipFilters));

    const membershipCountMap = new Map<number, number>();
    if (beheerMode && deelnemerIdsForQuery.length > 0) {
      const countRows = await db
        .select({ iddeelnemer: waarneemgroepdeelnemers.iddeelnemer })
        .from(waarneemgroepdeelnemers)
        .where(inArray(waarneemgroepdeelnemers.iddeelnemer, deelnemerIdsForQuery));
      for (const row of countRows) {
        if (row.iddeelnemer === null) continue;
        membershipCountMap.set(row.iddeelnemer, (membershipCountMap.get(row.iddeelnemer) ?? 0) + 1);
      }
    }

    // Group memberships by deelnemer
    const membershipMap = new Map<
      number,
      {
        id: number;
        naam: string | null;
        aangemeld: boolean;
        idgroep: number | null;
        idfunctie: number | null;
      }[]
    >();
    for (const m of memberships) {
      if (m.iddeelnemer === null || m.idwaarneemgroep === null) continue;
      if (!membershipMap.has(m.iddeelnemer)) membershipMap.set(m.iddeelnemer, []);
      membershipMap.get(m.iddeelnemer)!.push({
        id: m.idwaarneemgroep,
        naam: m.naam,
        aangemeld: m.aangemeld ?? false,
        idgroep: m.idgroep ?? null,
        idfunctie: m.idfunctie ?? null,
      });
    }

    const result: DeelnemerWithGroepen[] = deelnemerRows.map((d) => {
      const id = d.id ?? 0;
      const entry: DeelnemerWithGroepen = {
        id,
        voornaam: d.voornaam,
        voorletterstussenvoegsel: d.voorletterstussenvoegsel,
        achternaam: d.achternaam,
        initialen: d.initialen,
        login: d.login,
        color: d.color,
        idgroep: d.idgroep,
        emailVerified: d.emailVerified,
        echtedeelnemer: d.echtedeelnemer,
        waarneemgroepen: membershipMap.get(id) ?? [],
      };
      if (beheerMode) {
        entry.membershipCount = membershipCountMap.get(id) ?? 0;
      }
      return entry;
    });

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
