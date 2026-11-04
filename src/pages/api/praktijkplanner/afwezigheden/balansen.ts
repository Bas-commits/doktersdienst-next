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
            isVoorlopig: schema.planningafwezigheden.isVoorlopig,
            datum: schema.planningafwezigheden.datum,
            dagdeel: schema.dagdelen.naam,
            dagdeelVolgorde: schema.dagdelen.volgorde,
          })
          .from(schema.planningafwezigheden)
          .innerJoin(schema.dagdelen, eq(schema.dagdelen.id, schema.planningafwezigheden.iddagdeel))
          .where(
            and(
              eq(schema.planningafwezigheden.idwaarneemgroep, accessResult.access.idwaarneemgroep),
              eq(schema.planningafwezigheden.iddeelnemer, iddeelnemer),
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
            },
          ])
      );
      const mutationsByType = new Map<number, PraktijkplannerYearBalance['mutatieDatums']>();
      const provisionalMutationsByType = new Map<number, PraktijkplannerYearBalance['mutatieDatumsVoorlopig']>();
      const sortedAbsences = [...absences].sort((left, right) => {
        const byDate = (left.datum ?? '').localeCompare(right.datum ?? '');
        if (byDate !== 0) return byDate;
        return (left.dagdeelVolgorde ?? 0) - (right.dagdeelVolgorde ?? 0);
      });
      for (const absence of sortedAbsences) {
        if (absence.idafwezigheidstype == null || !absence.datum || !absence.dagdeel) continue;
        const target = absence.isVoorlopig ? provisionalMutationsByType : mutationsByType;
        const current = target.get(absence.idafwezigheidstype) ?? [];
        current.push({ datum: absence.datum, dagdeel: absence.dagdeel });
        target.set(absence.idafwezigheidstype, current);
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
          const configured = budgetByType.get(type.id) ?? { beginsaldo: 0, budget: 0 };
          const mutatieDatums = mutationsByType.get(type.id) ?? [];
          const mutatieDatumsVoorlopig = provisionalMutationsByType.get(type.id) ?? [];
          const mutaties = mutatieDatums.length;
          const mutatiesVoorlopig = mutatieDatumsVoorlopig.length;
          const available = configured.beginsaldo + configured.budget;
          return {
            absenceType: {
              id: type.id,
              naam: type.naam,
              code: type.code,
              kleur: type.kleur,
              icon: type.icon,
              actief: type.actief,
            },
            beginsaldo: configured.beginsaldo,
            budget: configured.budget,
            mutaties,
            mutatiesVoorlopig,
            mutatieDatums,
            mutatieDatumsVoorlopig,
            totaal: available - mutaties,
            totaalVoorlopig: available - mutaties - mutatiesVoorlopig,
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
      if (!idafwezigheidstype || beginsaldo == null || budget == null) {
        throw new Error('invalid balance');
      }
      return { idafwezigheidstype, beginsaldo, budget };
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
          correctie: 0,
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
