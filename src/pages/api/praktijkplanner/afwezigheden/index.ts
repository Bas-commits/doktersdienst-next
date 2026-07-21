import type { NextApiRequest, NextApiResponse } from 'next';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  canAccessPraktijkplannerParticipant,
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { isIsoDate, parsePositiveInteger } from '@/lib/praktijkplanner/dates';
import {
  assertDaypartSchedulable,
  SchedulableDaypartError,
} from '@/lib/praktijkplanner/schedulable-dayparts-db';
import type { PraktijkplannerAbsenceSlot } from '@/types/praktijkplanner';

type AbsenceMutation = {
  iddeelnemer: unknown;
  datum: unknown;
  iddagdeel: unknown;
  idafwezigheidstype?: unknown;
  isVoorlopig?: unknown;
  version?: unknown;
};

type Data = { slots: PraktijkplannerAbsenceSlot[] } | { success: true } | { error: string };

class AbsenceRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 500 = 400
  ) {
    super(message);
  }
}

function oneQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function nullableId(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  return parsePositiveInteger(value) ?? undefined;
}

/**
 * Confirmed absences govern the daypart: remove any activity planning so the
 * shift does not resurface when the absence overlay is shown.
 */
async function clearPlanningForConfirmedAbsence(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    idwaarneemgroep: number;
    iddeelnemer: number;
    datum: string;
    iddagdeel: number;
    userId: number;
  }
) {
  const [existing] = await tx
    .select({ id: schema.planning.id })
    .from(schema.planning)
    .where(
      and(
        eq(schema.planning.idwaarneemgroep, params.idwaarneemgroep),
        eq(schema.planning.iddeelnemer, params.iddeelnemer),
        eq(schema.planning.datum, params.datum),
        eq(schema.planning.iddagdeel, params.iddagdeel)
      )
    )
    .limit(1);

  if (existing?.id == null) return;

  const [link] = await tx
    .select({
      idherhaling: schema.planningherhalingslots.idherhaling,
      isBronslot: schema.planningherhalingslots.isBronslot,
    })
    .from(schema.planningherhalingslots)
    .where(eq(schema.planningherhalingslots.idplanning, existing.id))
    .limit(1);

  if (link?.idherhaling != null && !link.isBronslot) {
    await tx
      .insert(schema.planningherhalinguitzonderingen)
      .values({
        idherhaling: link.idherhaling,
        reeksdatum: params.datum,
        iddagdeel: params.iddagdeel,
        type: 'verwijderd',
        createdBy: params.userId,
      })
      .onConflictDoNothing();
  }

  await tx.delete(schema.planning).where(eq(schema.planning.id, existing.id));
}

async function loadAbsences(
  idwaarneemgroep: number,
  start: string,
  end: string,
  iddeelnemer?: number
): Promise<PraktijkplannerAbsenceSlot[]> {
  const conditions = [
    eq(schema.planningafwezigheden.idwaarneemgroep, idwaarneemgroep),
    gte(schema.planningafwezigheden.datum, start),
    lte(schema.planningafwezigheden.datum, end),
  ];
  if (iddeelnemer != null) conditions.push(eq(schema.planningafwezigheden.iddeelnemer, iddeelnemer));

  const rows = await db
    .select({
      id: schema.planningafwezigheden.id,
      iddeelnemer: schema.planningafwezigheden.iddeelnemer,
      datum: schema.planningafwezigheden.datum,
      iddagdeel: schema.planningafwezigheden.iddagdeel,
      idafwezigheidstype: schema.planningafwezigheden.idafwezigheidstype,
      isVoorlopig: schema.planningafwezigheden.isVoorlopig,
      version: schema.planningafwezigheden.version,
      typeId: schema.afwezigheidstypen.id,
      typeNaam: schema.afwezigheidstypen.naam,
      typeCode: schema.afwezigheidstypen.code,
      typeKleur: schema.afwezigheidstypen.kleur,
      typeIcon: schema.afwezigheidstypen.icon,
    })
    .from(schema.planningafwezigheden)
    .innerJoin(
      schema.afwezigheidstypen,
      eq(schema.planningafwezigheden.idafwezigheidstype, schema.afwezigheidstypen.id)
    )
    .where(and(...conditions))
    .orderBy(
      asc(schema.planningafwezigheden.datum),
      asc(schema.planningafwezigheden.iddagdeel),
      asc(schema.planningafwezigheden.iddeelnemer)
    );

  return rows
    .filter(
      (
        row
      ): row is typeof row & {
        id: number;
        iddeelnemer: number;
        datum: string;
        iddagdeel: number;
        idafwezigheidstype: number;
        isVoorlopig: boolean;
        version: number;
        typeId: number;
        typeNaam: string;
        typeCode: string;
      } =>
        row.id != null &&
        row.iddeelnemer != null &&
        row.datum != null &&
        row.iddagdeel != null &&
        row.idafwezigheidstype != null &&
        row.isVoorlopig != null &&
        row.version != null &&
        row.typeId != null &&
        row.typeNaam != null &&
        row.typeCode != null
    )
    .map((row) => ({
      id: row.id,
      iddeelnemer: row.iddeelnemer,
      datum: row.datum,
      iddagdeel: row.iddagdeel,
      idafwezigheidstype: row.idafwezigheidstype,
      isVoorlopig: row.isVoorlopig,
      version: row.version,
      absenceType: {
        id: row.typeId,
        naam: row.typeNaam,
        code: row.typeCode,
        kleur: row.typeKleur,
        icon: row.typeIcon,
      },
    }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method === 'GET') {
    const accessResult = await resolvePraktijkplannerAccess(
      req,
      oneQueryValue(req.query.idwaarneemgroep),
      'afwezigheid:self'
    );
    if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

    const start = oneQueryValue(req.query.start);
    const end = oneQueryValue(req.query.end);
    const requestedParticipantId = parsePositiveInteger(oneQueryValue(req.query.iddeelnemer));
    if (!isIsoDate(start) || !isIsoDate(end) || start > end) {
      return res.status(400).json({ error: 'Een geldig datumbereik is verplicht.' });
    }

    // No iddeelnemer → full group (needed for rooster overlay). Specific other
    // participants remain self-or-manager only.
    const scopedParticipantId =
      requestedParticipantId == null
        ? undefined
        : accessResult.access.isManager || requestedParticipantId === accessResult.access.user.id
          ? requestedParticipantId
          : accessResult.access.user.id;

    const canAccessParticipant =
      scopedParticipantId == null
        ? true
        : await canAccessPraktijkplannerParticipant(accessResult.access, scopedParticipantId);
    if (scopedParticipantId != null && !canAccessParticipant) {
      const error =
        scopedParticipantId === accessResult.access.user.id
          ? 'U bent geen actieve deelnemer in deze waarneemgroep.'
          : 'Geen toegang tot deze deelnemer.';
      return res.status(403).json({ error });
    }

    try {
      return res
        .status(200)
        .json({
          slots: await loadAbsences(
            accessResult.access.idwaarneemgroep,
            start,
            end,
            scopedParticipantId ?? undefined
          ),
        });
    } catch (error) {
      console.error('[praktijkplanner/afwezigheden GET]', error);
      return res.status(500).json({ error: 'De afwezigheden konden niet worden geladen.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as { idwaarneemgroep?: unknown; slots?: unknown };
  const accessResult = await resolvePraktijkplannerAccess(
    req,
    body.idwaarneemgroep,
    'afwezigheid:self'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);
  if (!Array.isArray(body.slots) || body.slots.length === 0 || body.slots.length > 200) {
    return res.status(400).json({ error: 'Voeg één tot maximaal 200 afwezigheidswijzigingen toe.' });
  }

  try {
    const mutations = body.slots.map((slot) => {
      const input = slot as AbsenceMutation;
      const iddeelnemer = parsePositiveInteger(input.iddeelnemer);
      const iddagdeel = parsePositiveInteger(input.iddagdeel);
      const idafwezigheidstype = nullableId(input.idafwezigheidstype);
      const version =
        input.version == null || input.version === '' ? null : parsePositiveInteger(input.version);
      if (
        !iddeelnemer ||
        !iddagdeel ||
        !isIsoDate(input.datum) ||
        idafwezigheidstype === undefined ||
        (input.isVoorlopig != null && typeof input.isVoorlopig !== 'boolean') ||
        (input.version != null && input.version !== '' && version == null)
      ) {
        throw new AbsenceRequestError('Een afwezigheidswijziging bevat ongeldige gegevens.');
      }
      return {
        iddeelnemer,
        datum: input.datum,
        iddagdeel,
        idafwezigheidstype,
        isVoorlopig: input.isVoorlopig === true,
        version,
      };
    });

    const daypartIds = [...new Set(mutations.map((slot) => slot.iddagdeel))];
    const foundDayparts = await db
      .select({ id: schema.dagdelen.id })
      .from(schema.dagdelen)
      .where(inArray(schema.dagdelen.id, daypartIds));
    if (foundDayparts.length !== daypartIds.length) {
      throw new AbsenceRequestError('Een gekozen dagdeel bestaat niet.');
    }

    for (const mutation of mutations) {
      if (!(await canAccessPraktijkplannerParticipant(accessResult.access, mutation.iddeelnemer))) {
        throw new AbsenceRequestError('Geen toegang tot deze deelnemer.', 403);
      }
      try {
        await assertDaypartSchedulable(
          accessResult.access.idwaarneemgroep,
          mutation.datum,
          mutation.iddagdeel,
          mutation.iddeelnemer
        );
      } catch (error) {
        if (error instanceof SchedulableDaypartError) {
          throw new AbsenceRequestError(error.message, 400);
        }
        throw error;
      }
      if (!accessResult.access.isManager && mutation.idafwezigheidstype != null && !mutation.isVoorlopig) {
        throw new AbsenceRequestError('Alleen secretarissen en beheerders kunnen afwezigheden bevestigen.', 403);
      }
      if (mutation.idafwezigheidstype != null) {
        const [type] = await db
          .select({ id: schema.afwezigheidstypen.id })
          .from(schema.afwezigheidstypen)
          .where(
            and(
              eq(schema.afwezigheidstypen.id, mutation.idafwezigheidstype),
              eq(schema.afwezigheidstypen.idwaarneemgroep, accessResult.access.idwaarneemgroep),
              eq(schema.afwezigheidstypen.actief, true)
            )
          )
          .limit(1);
        if (!type?.id) throw new AbsenceRequestError('Het gekozen afwezigheidstype is niet beschikbaar.');
      }
    }

    await db.transaction(async (tx) => {
      for (const mutation of mutations) {
        const [existing] = await tx
          .select({
            id: schema.planningafwezigheden.id,
            version: schema.planningafwezigheden.version,
            isVoorlopig: schema.planningafwezigheden.isVoorlopig,
          })
          .from(schema.planningafwezigheden)
          .where(
            and(
              eq(schema.planningafwezigheden.idwaarneemgroep, accessResult.access.idwaarneemgroep),
              eq(schema.planningafwezigheden.iddeelnemer, mutation.iddeelnemer),
              eq(schema.planningafwezigheden.datum, mutation.datum),
              eq(schema.planningafwezigheden.iddagdeel, mutation.iddagdeel)
            )
          )
          .limit(1);

        if (existing?.id != null && mutation.version != null && existing.version !== mutation.version) {
          throw new AbsenceRequestError(
            'Deze afwezigheid is ondertussen gewijzigd. Vernieuw de pagina en probeer opnieuw.',
            409
          );
        }
        if (!accessResult.access.isManager && existing?.isVoorlopig === false) {
          throw new AbsenceRequestError(
            'Deze afwezigheid is bevestigd en kan niet meer worden gewijzigd.',
            403
          );
        }

        if (mutation.idafwezigheidstype == null) {
          if (existing?.id != null) {
            await tx
              .delete(schema.planningafwezigheden)
              .where(eq(schema.planningafwezigheden.id, existing.id));
          }
          continue;
        }

        if (existing?.id != null) {
          await tx
            .update(schema.planningafwezigheden)
            .set({
              idafwezigheidstype: mutation.idafwezigheidstype,
              isVoorlopig: mutation.isVoorlopig,
              updatedBy: accessResult.access.user.id,
            })
            .where(eq(schema.planningafwezigheden.id, existing.id));
        } else {
          await tx.insert(schema.planningafwezigheden).values({
            idwaarneemgroep: accessResult.access.idwaarneemgroep,
            iddeelnemer: mutation.iddeelnemer,
            datum: mutation.datum,
            iddagdeel: mutation.iddagdeel,
            idafwezigheidstype: mutation.idafwezigheidstype,
            isVoorlopig: mutation.isVoorlopig,
            createdBy: accessResult.access.user.id,
            updatedBy: accessResult.access.user.id,
          });
        }

        if (!mutation.isVoorlopig) {
          await clearPlanningForConfirmedAbsence(tx, {
            idwaarneemgroep: accessResult.access.idwaarneemgroep,
            iddeelnemer: mutation.iddeelnemer,
            datum: mutation.datum,
            iddagdeel: mutation.iddagdeel,
            userId: accessResult.access.user.id,
          });
        }
      }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof AbsenceRequestError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[praktijkplanner/afwezigheden POST]', error);
    return res.status(500).json({ error: 'De afwezigheden konden niet worden opgeslagen.' });
  }
}
