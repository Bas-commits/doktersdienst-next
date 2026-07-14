import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  canAccessPraktijkplannerParticipant,
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { parseNonNegativeInteger, parsePositiveInteger } from '@/lib/praktijkplanner/dates';
import type { PraktijkplannerYearBalance } from '@/types/praktijkplanner';

type Data =
  | { balances: PraktijkplannerYearBalance[]; note: string }
  | { success: true }
  | { error: string };

function oneQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseYear(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : null;
}

function safeNote(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 10_000) return null;
  return value.trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method === 'GET') {
    const accessResult = await resolvePraktijkplannerAccess(
      req,
      oneQueryValue(req.query.idwaarneemgroep),
      'dokter-afwezigheid:read'
    );
    if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

    const iddeelnemer = parsePositiveInteger(oneQueryValue(req.query.iddeelnemer));
    const jaar = parseYear(oneQueryValue(req.query.jaar));
    if (!iddeelnemer || !jaar) {
      return res.status(400).json({ error: 'Een geldige deelnemer en jaar zijn verplicht.' });
    }
    if (!(await canAccessPraktijkplannerParticipant(accessResult.access, iddeelnemer))) {
      return res.status(403).json({ error: 'Geen toegang tot deze deelnemer.' });
    }

    try {
      const start = `${jaar}-01-01`;
      const end = `${jaar}-12-31`;
      const [types, budgets, absences, notes] = await Promise.all([
        db
          .select({
            id: schema.afwezigheidstypen.id,
            naam: schema.afwezigheidstypen.naam,
            code: schema.afwezigheidstypen.code,
            kleur: schema.afwezigheidstypen.kleur,
            icon: schema.afwezigheidstypen.icon,
            actief: schema.afwezigheidstypen.actief,
          })
          .from(schema.afwezigheidstypen)
          .where(
            and(
              eq(schema.afwezigheidstypen.idwaarneemgroep, accessResult.access.idwaarneemgroep),
              eq(schema.afwezigheidstypen.actief, true)
            )
          ),
        db
          .select({
            idafwezigheidstype: schema.afwezigheidsjaarbudgetten.idafwezigheidstype,
            beginsaldo: schema.afwezigheidsjaarbudgetten.beginsaldo,
            budget: schema.afwezigheidsjaarbudgetten.budget,
            correctie: schema.afwezigheidsjaarbudgetten.correctie,
          })
          .from(schema.afwezigheidsjaarbudgetten)
          .where(
            and(
              eq(schema.afwezigheidsjaarbudgetten.idwaarneemgroep, accessResult.access.idwaarneemgroep),
              eq(schema.afwezigheidsjaarbudgetten.iddeelnemer, iddeelnemer),
              eq(schema.afwezigheidsjaarbudgetten.jaar, jaar)
            )
          ),
        db
          .select({
            idafwezigheidstype: schema.planningafwezigheden.idafwezigheidstype,
          })
          .from(schema.planningafwezigheden)
          .where(
            and(
              eq(schema.planningafwezigheden.idwaarneemgroep, accessResult.access.idwaarneemgroep),
              eq(schema.planningafwezigheden.iddeelnemer, iddeelnemer),
              eq(schema.planningafwezigheden.isVoorlopig, false),
              gte(schema.planningafwezigheden.datum, start),
              lte(schema.planningafwezigheden.datum, end)
            )
          ),
        db
          .select({ notitie: schema.afwezigheidsjaarnotities.notitie })
          .from(schema.afwezigheidsjaarnotities)
          .where(
            and(
              eq(schema.afwezigheidsjaarnotities.idwaarneemgroep, accessResult.access.idwaarneemgroep),
              eq(schema.afwezigheidsjaarnotities.iddeelnemer, iddeelnemer),
              eq(schema.afwezigheidsjaarnotities.jaar, jaar)
            )
          )
          .limit(1),
      ]);

      const budgetByType = new Map(
        budgets
          .filter((row) => row.idafwezigheidstype != null)
          .map((row) => [
            row.idafwezigheidstype as number,
            {
              beginsaldo: row.beginsaldo ?? 0,
              budget: row.budget ?? 0,
              correctie: row.correctie ?? 0,
            },
          ])
      );
      const mutationsByType = new Map<number, number>();
      for (const absence of absences) {
        if (absence.idafwezigheidstype == null) continue;
        mutationsByType.set(
          absence.idafwezigheidstype,
          (mutationsByType.get(absence.idafwezigheidstype) ?? 0) + 1
        );
      }

      const balances: PraktijkplannerYearBalance[] = types
        .filter(
          (
            type
          ): type is typeof type & {
            id: number;
            naam: string;
            code: string;
            actief: boolean;
          } => type.id != null && type.naam != null && type.code != null && type.actief != null
        )
        .map((type) => {
          const configured = budgetByType.get(type.id) ?? { beginsaldo: 0, budget: 0, correctie: 0 };
          const mutaties = mutationsByType.get(type.id) ?? 0;
          return {
            absenceType: {
              id: type.id,
              naam: type.naam,
              code: type.code,
              kleur: type.kleur,
              icon: type.icon,
              actief: type.actief,
            },
            ...configured,
            mutaties,
            totaal: configured.beginsaldo + configured.budget + configured.correctie - mutaties,
          };
        });

      return res.status(200).json({ balances, note: notes[0]?.notitie ?? '' });
    } catch (error) {
      console.error('[praktijkplanner/afwezigheden/balansen GET]', error);
      return res.status(500).json({ error: 'De afwezigheidsbalans kon niet worden geladen.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const accessResult = await resolvePraktijkplannerAccess(
    req,
    body.idwaarneemgroep,
    'dokter-afwezigheid:manage'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  const iddeelnemer = parsePositiveInteger(body.iddeelnemer);
  const jaar = parseYear(body.jaar);
  const note = safeNote(body.note);
  if (!iddeelnemer || !jaar || !Array.isArray(body.balances) || note == null) {
    return res.status(400).json({ error: 'De balansgegevens zijn ongeldig.' });
  }
  if (
    !(await canAccessPraktijkplannerParticipant(accessResult.access, iddeelnemer, {
      requireManager: true,
    }))
  ) {
    return res.status(403).json({ error: 'Geen toegang tot deze deelnemer.' });
  }

  try {
    const parsedBalances = body.balances.map((item) => {
      const row = item as Record<string, unknown>;
      const idafwezigheidstype = parsePositiveInteger(row.idafwezigheidstype);
      const beginsaldo = parseNonNegativeInteger(row.beginsaldo);
      const budget = parseNonNegativeInteger(row.budget);
      const correctie = Number(row.correctie);
      if (
        !idafwezigheidstype ||
        beginsaldo == null ||
        budget == null ||
        !Number.isInteger(correctie) ||
        Math.abs(correctie) > 10_000
      ) {
        throw new Error('invalid balance');
      }
      return { idafwezigheidstype, beginsaldo, budget, correctie };
    });
    const typeRows = await db
      .select({ id: schema.afwezigheidstypen.id })
      .from(schema.afwezigheidstypen)
      .where(eq(schema.afwezigheidstypen.idwaarneemgroep, accessResult.access.idwaarneemgroep));
    const validTypeIds = new Set(typeRows.map((row) => row.id).filter((id): id is number => id != null));
    if (parsedBalances.some((balance) => !validTypeIds.has(balance.idafwezigheidstype))) {
      return res.status(400).json({ error: 'Een afwezigheidstype hoort niet bij deze waarneemgroep.' });
    }

    await db.transaction(async (tx) => {
      for (const balance of parsedBalances) {
        const where = and(
          eq(schema.afwezigheidsjaarbudgetten.idwaarneemgroep, accessResult.access.idwaarneemgroep),
          eq(schema.afwezigheidsjaarbudgetten.iddeelnemer, iddeelnemer),
          eq(schema.afwezigheidsjaarbudgetten.idafwezigheidstype, balance.idafwezigheidstype),
          eq(schema.afwezigheidsjaarbudgetten.jaar, jaar)
        );
        const [existing] = await tx
          .select({ id: schema.afwezigheidsjaarbudgetten.id })
          .from(schema.afwezigheidsjaarbudgetten)
          .where(where)
          .limit(1);
        const values = {
          beginsaldo: balance.beginsaldo,
          budget: balance.budget,
          correctie: balance.correctie,
          updatedBy: accessResult.access.user.id,
          updatedAt: new Date().toISOString(),
        };
        if (existing?.id != null) {
          await tx.update(schema.afwezigheidsjaarbudgetten).set(values).where(eq(schema.afwezigheidsjaarbudgetten.id, existing.id));
        } else {
          await tx.insert(schema.afwezigheidsjaarbudgetten).values({
            ...values,
            idwaarneemgroep: accessResult.access.idwaarneemgroep,
            iddeelnemer,
            idafwezigheidstype: balance.idafwezigheidstype,
            jaar,
          });
        }
      }

      const noteWhere = and(
        eq(schema.afwezigheidsjaarnotities.idwaarneemgroep, accessResult.access.idwaarneemgroep),
        eq(schema.afwezigheidsjaarnotities.iddeelnemer, iddeelnemer),
        eq(schema.afwezigheidsjaarnotities.jaar, jaar)
      );
      const [existingNote] = await tx
        .select({ jaar: schema.afwezigheidsjaarnotities.jaar })
        .from(schema.afwezigheidsjaarnotities)
        .where(noteWhere)
        .limit(1);
      if (existingNote) {
        await tx
          .update(schema.afwezigheidsjaarnotities)
          .set({
            notitie: note,
            updatedBy: accessResult.access.user.id,
            updatedAt: new Date().toISOString(),
          })
          .where(noteWhere);
      } else {
        await tx.insert(schema.afwezigheidsjaarnotities).values({
          idwaarneemgroep: accessResult.access.idwaarneemgroep,
          iddeelnemer,
          jaar,
          notitie: note,
          updatedBy: accessResult.access.user.id,
        });
      }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid balance') {
      return res.status(400).json({ error: 'Een balansregel bevat ongeldige waarden.' });
    }
    console.error('[praktijkplanner/afwezigheden/balansen POST]', error);
    return res.status(500).json({ error: 'De afwezigheidsbalans kon niet worden opgeslagen.' });
  }
}
