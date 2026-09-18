import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';
import { intervalsOverlap } from '@/hooks/useDienstenSchedule';
import { aggregateUrentelling } from '@/lib/urentelling';
import {
  generateAutoplanningProposal,
  type AutoplanningCandidate,
  type AutoplanningInterval,
  type AutoplanningSection,
  type AutoplanningSlot,
} from '@/lib/autoplanning';

const { diensten: dienstenTable, deelnemers, waarneemgroepdeelnemers } = schema;

/** Zelfde sectie/type-mapping als /api/diensten/assign. */
const SECTION_TYPES: Record<AutoplanningSection, readonly number[]> = {
  middle: [0, 4, 6],
  top: [5],
  bottom: [11],
};
const ASSIGNMENT_TYPES = [0, 4, 5, 6, 11];

type Data =
  | {
      slots: AutoplanningSlot[];
      assignments: ReturnType<typeof generateAutoplanningProposal>['assignments'];
      unfilled: string[];
    }
  | { error: string };

function normalizeMemberFte(fte: number | null | undefined): number {
  if (fte == null || Number.isNaN(fte)) return 1;
  return fte;
}

function slotId(van: number, tot: number, section: AutoplanningSection): string {
  return `${van}:${tot}:${section}`;
}

/**
 * POST /api/autoplanning/generate
 *
 * Genereert een roostervoorstel voor één waarneemgroep en periode. Schrijft niets weg —
 * de secretaris beoordeelt en bevestigt het voorstel via /api/autoplanning/confirm.
 *
 * Body:
 *   idwaarneemgroep  number
 *   vanMaand/vanJaar/totMaand/totJaar  number (0-indexed maand, zelfde vorm als rooster-email)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { idwaarneemgroep, vanMaand, vanJaar, totMaand, totJaar } = req.body as {
    idwaarneemgroep?: number;
    vanMaand?: number;
    vanJaar?: number;
    totMaand?: number;
    totJaar?: number;
  };

  if (
    typeof idwaarneemgroep !== 'number' ||
    vanMaand == null ||
    vanJaar == null ||
    totMaand == null ||
    totJaar == null
  ) {
    return res.status(400).json({ error: 'Waarneemgroep en periode zijn verplicht' });
  }

  const hasAccess = await hasGroupManagementAccess(user, idwaarneemgroep);
  if (!hasAccess) {
    return res.status(403).json({ error: 'U kunt niet plannen in deze waarneemgroep. U bent geen secretaris.' });
  }

  const vanGte = Math.floor(new Date(vanJaar, vanMaand, 1).getTime() / 1000);
  const totLte = Math.floor(new Date(totJaar, totMaand + 1, 0, 23, 59, 59).getTime() / 1000);

  try {
    const memberRows = await db
      .select({
        iddeelnemer: deelnemers.id,
        achternaam: deelnemers.achternaam,
        voornaam: deelnemers.voornaam,
        voorletterstussenvoegsel: deelnemers.voorletterstussenvoegsel,
        initialen: deelnemers.initialen,
        color: deelnemers.color,
        fte: waarneemgroepdeelnemers.fte,
      })
      .from(waarneemgroepdeelnemers)
      .innerJoin(deelnemers, eq(waarneemgroepdeelnemers.iddeelnemer, deelnemers.id))
      .where(
        and(
          eq(waarneemgroepdeelnemers.idwaarneemgroep, idwaarneemgroep),
          eq(waarneemgroepdeelnemers.aangemeld, true),
          eq(deelnemers.echtedeelnemer, true),
        ),
      );

    const members = memberRows.filter((row) => row.iddeelnemer != null);
    const candidates: AutoplanningCandidate[] = members.map((row) => ({
      iddeelnemer: row.iddeelnemer!,
      fte: normalizeMemberFte(row.fte),
    }));

    const baseSlotRows = await db
      .select({
        van: dienstenTable.van,
        tot: dienstenTable.tot,
      })
      .from(dienstenTable)
      .where(
        and(
          eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
          eq(dienstenTable.type, 1),
          lt(dienstenTable.van, totLte),
          gt(dienstenTable.tot, vanGte),
        ),
      );

    const assignmentRows = await db
      .select({
        iddeelnemer: dienstenTable.iddeelnemer,
        van: dienstenTable.van,
        tot: dienstenTable.tot,
        type: dienstenTable.type,
      })
      .from(dienstenTable)
      .where(
        and(
          eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
          inArray(dienstenTable.type, ASSIGNMENT_TYPES),
          lt(dienstenTable.van, totLte),
          gt(dienstenTable.tot, vanGte),
        ),
      );

    const assignments = assignmentRows
      .filter((row) => row.iddeelnemer != null)
      .map((row) => ({
        iddeelnemer: row.iddeelnemer!,
        van: Number(row.van ?? 0),
        tot: Number(row.tot ?? 0),
        type: row.type,
      }));

    const slots: AutoplanningSlot[] = [];
    for (const base of baseSlotRows) {
      const van = Number(base.van ?? 0);
      const tot = Number(base.tot ?? 0);
      for (const section of Object.keys(SECTION_TYPES) as AutoplanningSection[]) {
        const alreadyAssigned = assignments.some(
          (a) => SECTION_TYPES[section].includes(a.type ?? -1) && intervalsOverlap(van, tot, a.van, a.tot),
        );
        if (!alreadyAssigned) {
          slots.push({ id: slotId(van, tot, section), van, tot, section });
        }
      }
    }

    const voorkeurRows = await db
      .select({
        iddeelnemer: dienstenTable.iddeelnemer,
        van: dienstenTable.van,
        tot: dienstenTable.tot,
        type: dienstenTable.type,
      })
      .from(dienstenTable)
      .where(
        and(
          eq(dienstenTable.idwaarneemgroep, idwaarneemgroep),
          inArray(dienstenTable.type, [2, 9, 10]),
          lt(dienstenTable.van, totLte),
          gt(dienstenTable.tot, vanGte),
        ),
      );

    const absences: AutoplanningInterval[] = [];
    const lieverNiet: AutoplanningInterval[] = [];
    for (const row of voorkeurRows) {
      if (row.iddeelnemer == null) continue;
      const interval = {
        iddeelnemer: row.iddeelnemer,
        van: Number(row.van ?? 0),
        tot: Number(row.tot ?? 0),
      };
      if (row.type === 9 || row.type === 10) {
        absences.push(interval);
      } else if (row.type === 2) {
        lieverNiet.push(interval);
      }
    }

    const otherSectionAssignments: AutoplanningInterval[] = assignments.map((a) => ({
      iddeelnemer: a.iddeelnemer,
      van: a.van,
      tot: a.tot,
    }));

    const urentellingDiensten = assignmentRows.map((row) => ({
      iddeelnemer: row.iddeelnemer,
      van: Number(row.van ?? 0),
      tot: Number(row.tot ?? 0),
      type: row.type,
      status: null,
    }));

    const { rows: urentellingRows } = aggregateUrentelling(
      urentellingDiensten,
      members.map((m) => ({
        iddeelnemer: m.iddeelnemer!,
        achternaam: m.achternaam,
        voornaam: m.voornaam,
        voorletterstussenvoegsel: m.voorletterstussenvoegsel,
        initialen: m.initialen,
        color: m.color,
        fte: normalizeMemberFte(m.fte),
      })),
      vanGte,
      totLte,
      [],
      [],
    );

    const existingHoursByMember = new Map(
      urentellingRows.map((row) => [row.iddeelnemer, row.totaalDienst]),
    );
    const totalExpectedHoursSoFar = urentellingRows.reduce(
      (sum, row) => sum + row.totaalDienst,
      0,
    );

    const { assignments: proposalAssignments, unfilled } = generateAutoplanningProposal({
      slots,
      candidates,
      absences,
      lieverNiet,
      otherSectionAssignments,
      existingHoursByMember,
      totalExpectedHoursSoFar,
    });

    return res.status(200).json({ slots, assignments: proposalAssignments, unfilled });
  } catch (err) {
    console.error('[api/autoplanning/generate]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
