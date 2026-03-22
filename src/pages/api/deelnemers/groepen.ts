import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const { deelnemers, waarneemgroepen, waarneemgroepdeelnemers } = schema;

const GROEP_ADMINISTRATOR = 5;

export type DeelnemerGroepRow = {
  deelnemerId: number;
  voornaam: string | null;
  voorletterstussenvoegsel: string | null;
  achternaam: string | null;
  wgId: number;
  wgNaam: string | null;
  /** Whether this participant is registered in this group (false if no record exists) */
  aangemeld: boolean;
  /** Role in this specific waarneemgroep (idgroep from junction table); null if not registered */
  idgroepInWg: number | null;
};

type Data = { rows: DeelnemerGroepRow[] } | { error: string };

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

/**
 * GET /api/deelnemers/groepen
 *
 * Reconstructs the legacy deelnemers.perwaarneemgroep.php behaviour:
 *
 * The "template" groups (shown for every participant) are:
 *   - Admin:     ALL active waarneemgroepen in the system
 *   - Non-admin: The current user's own waarneemgroep memberships
 *
 * The participants shown are:
 *   - Admin:     All participants linked to the admin's primary waarneemgroep (deelnemers.idwaarneemgroep)
 *   - Non-admin: All participants in any of the current user's groups
 *
 * Every template-group is shown for every participant, even if no wgd record
 * exists (aangemeld = false → Aanmelden button).
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

    const [currentUser] = await db
      .select({
        id: deelnemers.id,
        idgroep: deelnemers.idgroep,
        idwaarneemgroep: deelnemers.idwaarneemgroep,
      })
      .from(deelnemers)
      .where(eq(deelnemers.email, email))
      .limit(1);

    if (!currentUser) {
      return res.status(403).json({ error: 'Deelnemer not found' });
    }

    const isAdmin = currentUser.idgroep === GROEP_ADMINISTRATOR;

    // ── Step 1: Build the template groups ──────────────────────────────────
    type TemplateGroup = { id: number; naam: string | null };
    let templateGroups: TemplateGroup[];

    if (isAdmin) {
      // Admin sees ALL active waarneemgroepen
      const allWg = await db
        .select({ id: waarneemgroepen.id, naam: waarneemgroepen.naam })
        .from(waarneemgroepen)
        .where(eq(waarneemgroepen.afgemeld, false))
        .orderBy(waarneemgroepen.naam);
      templateGroups = allWg
        .filter((w) => w.id !== null)
        .map((w) => ({ id: w.id!, naam: w.naam }));
    } else {
      // Non-admin: current user's own group memberships
      const myMemberships = await db
        .select({
          id: waarneemgroepen.id,
          naam: waarneemgroepen.naam,
        })
        .from(waarneemgroepdeelnemers)
        .leftJoin(waarneemgroepen, eq(waarneemgroepdeelnemers.idwaarneemgroep, waarneemgroepen.id))
        .where(eq(waarneemgroepdeelnemers.iddeelnemer, currentUser.id))
        .orderBy(waarneemgroepen.naam);
      templateGroups = myMemberships
        .filter((m) => m.id !== null)
        .map((m) => ({ id: m.id!, naam: m.naam }));
    }

    if (templateGroups.length === 0) {
      return res.status(200).json({ rows: [] });
    }

    const templateGroupIds = templateGroups.map((g) => g.id);

    // ── Step 2: Determine which participants to show ───────────────────────
    type ParticipantInfo = {
      id: number;
      voornaam: string | null;
      voorletterstussenvoegsel: string | null;
      achternaam: string | null;
    };
    let participants: ParticipantInfo[];

    if (isAdmin) {
      // Admin: participants linked to the admin's primary waarneemgroep
      const adminPrimaryWgId = currentUser.idwaarneemgroep;
      if (!adminPrimaryWgId) {
        return res.status(200).json({ rows: [] });
      }
      const memberIds = await db
        .select({ iddeelnemer: waarneemgroepdeelnemers.iddeelnemer })
        .from(waarneemgroepdeelnemers)
        .where(eq(waarneemgroepdeelnemers.idwaarneemgroep, adminPrimaryWgId));

      const ids = memberIds.map((m) => m.iddeelnemer).filter((id): id is number => id !== null);
      if (ids.length === 0) return res.status(200).json({ rows: [] });

      const participantRows = await db
        .select({
          id: deelnemers.id,
          voornaam: deelnemers.voornaam,
          voorletterstussenvoegsel: deelnemers.voorletterstussenvoegsel,
          achternaam: deelnemers.achternaam,
        })
        .from(deelnemers)
        .where(and(inArray(deelnemers.id, ids), eq(deelnemers.abonnementdd, true)))
        .orderBy(deelnemers.achternaam, deelnemers.voornaam);

      participants = participantRows.filter((p) => p.id !== null) as ParticipantInfo[];
    } else {
      // Non-admin: participants in any of current user's groups
      const colleagueIds = await db
        .select({ iddeelnemer: waarneemgroepdeelnemers.iddeelnemer })
        .from(waarneemgroepdeelnemers)
        .where(inArray(waarneemgroepdeelnemers.idwaarneemgroep, templateGroupIds));

      const ids = [
        ...new Set(
          colleagueIds.map((c) => c.iddeelnemer).filter((id): id is number => id !== null)
        ),
      ];
      if (ids.length === 0) return res.status(200).json({ rows: [] });

      const participantRows = await db
        .select({
          id: deelnemers.id,
          voornaam: deelnemers.voornaam,
          voorletterstussenvoegsel: deelnemers.voorletterstussenvoegsel,
          achternaam: deelnemers.achternaam,
        })
        .from(deelnemers)
        .where(and(inArray(deelnemers.id, ids), eq(deelnemers.abonnementdd, true)))
        .orderBy(deelnemers.achternaam, deelnemers.voornaam);

      participants = participantRows.filter((p) => p.id !== null) as ParticipantInfo[];
    }

    if (participants.length === 0) {
      return res.status(200).json({ rows: [] });
    }

    // ── Step 3: Fetch existing wgd records for (participants × templateGroups) ──
    const participantIds = participants.map((p) => p.id);

    const existingMemberships = await db
      .select({
        iddeelnemer: waarneemgroepdeelnemers.iddeelnemer,
        idwaarneemgroep: waarneemgroepdeelnemers.idwaarneemgroep,
        aangemeld: waarneemgroepdeelnemers.aangemeld,
        idgroep: waarneemgroepdeelnemers.idgroep,
      })
      .from(waarneemgroepdeelnemers)
      .where(
        and(
          inArray(waarneemgroepdeelnemers.iddeelnemer, participantIds),
          inArray(waarneemgroepdeelnemers.idwaarneemgroep, templateGroupIds)
        )
      );

    // Index by "deelnemerId-wgId" for O(1) lookup
    const membershipIndex = new Map<string, { aangemeld: boolean; idgroep: number | null }>();
    for (const m of existingMemberships) {
      if (m.iddeelnemer === null || m.idwaarneemgroep === null) continue;
      membershipIndex.set(`${m.iddeelnemer}-${m.idwaarneemgroep}`, {
        aangemeld: m.aangemeld ?? false,
        idgroep: m.idgroep,
      });
    }

    // ── Step 4: Build cross-product (participant × templateGroup) ──────────
    const rows: DeelnemerGroepRow[] = [];
    for (const participant of participants) {
      for (const group of templateGroups) {
        const membership = membershipIndex.get(`${participant.id}-${group.id}`);
        rows.push({
          deelnemerId: participant.id,
          voornaam: participant.voornaam,
          voorletterstussenvoegsel: participant.voorletterstussenvoegsel,
          achternaam: participant.achternaam,
          wgId: group.id,
          wgNaam: group.naam,
          aangemeld: membership?.aangemeld ?? false,
          idgroepInWg: membership?.idgroep ?? null,
        });
      }
    }

    return res.status(200).json({ rows });
  } catch (err) {
    console.error('deelnemers/groepen API error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
