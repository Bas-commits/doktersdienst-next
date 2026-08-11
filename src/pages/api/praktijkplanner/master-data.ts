import type { NextApiRequest, NextApiResponse } from 'next';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { getPraktijkplannerMasterData } from '@/lib/praktijkplanner/master-data';
import { parsePositiveInteger } from '@/lib/praktijkplanner/dates';

type Entity =
  | 'expertise'
  | 'activity'
  | 'specification'
  | 'location'
  | 'absenceType'
  | 'availabilityType'
  | 'task';

type Data =
  | Awaited<ReturnType<typeof getPraktijkplannerMasterData>>
  | { success: true; id: number }
  | { error: string };

function textValue(value: unknown, options: { required?: boolean; max?: number } = {}): string | null {
  if (typeof value !== 'string') return options.required ? null : '';
  const trimmed = value.trim();
  if (options.required && !trimmed) return null;
  if (options.max && trimmed.length > options.max) return null;
  return trimmed;
}

function optionalText(value: unknown, max: number): string | null {
  const parsed = textValue(value, { max });
  return parsed ? parsed : null;
}

function activeValue(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

async function activityBelongsToGroup(idactiviteit: number, idwaarneemgroep: number) {
  const [row] = await db
    .select({ id: schema.activiteiten.id })
    .from(schema.activiteiten)
    .where(and(eq(schema.activiteiten.id, idactiviteit), eq(schema.activiteiten.idwaarneemgroep, idwaarneemgroep)))
    .limit(1);
  return row?.id != null;
}

async function expertiseBelongsToGroup(idexpertise: number, idwaarneemgroep: number) {
  const [row] = await db
    .select({ id: schema.expertises.id })
    .from(schema.expertises)
    .where(and(eq(schema.expertises.id, idexpertise), eq(schema.expertises.idwaarneemgroep, idwaarneemgroep)))
    .limit(1);
  return row?.id != null;
}

async function specificationBelongsToGroup(idspecificatie: number, idwaarneemgroep: number) {
  const [row] = await db
    .select({ id: schema.activiteitSpecificaties.id })
    .from(schema.activiteitSpecificaties)
    .innerJoin(
      schema.activiteiten,
      eq(schema.activiteitSpecificaties.idactiviteit, schema.activiteiten.id)
    )
    .where(
      and(
        eq(schema.activiteitSpecificaties.id, idspecificatie),
        eq(schema.activiteiten.idwaarneemgroep, idwaarneemgroep)
      )
    )
    .limit(1);
  return row?.id != null;
}

async function resolveOptionalExpertiseId(
  value: unknown,
  idwaarneemgroep: number
): Promise<{ ok: true; idexpertise: number | null } | { ok: false }> {
  const idexpertise = parsePositiveInteger(value);
  if (idexpertise == null) {
    if (value === '' || value == null || value === undefined) {
      return { ok: true, idexpertise: null };
    }
    return { ok: false };
  }
  if (!(await expertiseBelongsToGroup(idexpertise, idwaarneemgroep))) {
    return { ok: false };
  }
  return { ok: true, idexpertise };
}

async function nextTaskTypeId() {
  const [row] = await db
    .select({ id: schema.taaktypen.id })
    .from(schema.taaktypen)
    .orderBy(desc(schema.taaktypen.id))
    .limit(1);
  return (row?.id ?? 0) + 1;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method === 'GET') {
    const accessResult = await resolvePraktijkplannerAccess(
      req,
      req.query.idwaarneemgroep,
      'activiteiten:read'
    );
    if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

    const includeInactive = req.query.includeInactive === 'true' && accessResult.access.user.isAdmin;
    try {
      return res
        .status(200)
        .json(await getPraktijkplannerMasterData(accessResult.access.idwaarneemgroep, { includeInactive }));
    } catch (error) {
      console.error('[praktijkplanner/master-data GET]', error);
      return res.status(500).json({ error: 'De stamgegevens konden niet worden geladen.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const accessResult = await resolvePraktijkplannerAccess(
    req,
    body.idwaarneemgroep,
    'beheer:manage'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  const entity = body.entity as Entity;
  const action = body.action;
  const id = parsePositiveInteger(body.id);
  const { idwaarneemgroep } = accessResult.access;

  if (
    !['expertise', 'activity', 'specification', 'location', 'absenceType', 'availabilityType', 'task'].includes(
      entity
    ) ||
    !['create', 'update', 'archive'].includes(String(action))
  ) {
    return res.status(400).json({ error: 'Ongeldige beheeractie.' });
  }

  try {
    if (action === 'create') {
      if (entity === 'expertise') {
        const naam = textValue(body.naam, { required: true, max: 255 });
        if (!naam) return res.status(400).json({ error: 'Een expertisenaam is verplicht.' });
        const [created] = await db
          .insert(schema.expertises)
          .values({
            naam,
            afkorting: optionalText(body.afkorting, 50),
            idwaarneemgroep,
            actief: true,
          })
          .returning({ id: schema.expertises.id });
        return res.status(201).json({ success: true, id: created.id });
      }

      if (entity === 'activity') {
        const naam = textValue(body.naam, { required: true, max: 255 });
        if (!naam) return res.status(400).json({ error: 'Een activiteitsnaam is verplicht.' });
        const expertise = await resolveOptionalExpertiseId(body.idexpertise, idwaarneemgroep);
        if (!expertise.ok) return res.status(400).json({ error: 'Kies een geldige expertise.' });
        const [created] = await db
          .insert(schema.activiteiten)
          .values({
            naam,
            afkorting: optionalText(body.afkorting, 50),
            kleur: optionalText(body.kleur, 50),
            icon: optionalText(body.icon, 100),
            idexpertise: expertise.idexpertise,
            idwaarneemgroep,
            actief: true,
          })
          .returning({ id: schema.activiteiten.id });
        return res.status(201).json({ success: true, id: created.id });
      }

      if (entity === 'specification') {
        const naam = textValue(body.naam, { required: true, max: 255 });
        const idactiviteit = parsePositiveInteger(body.idactiviteit);
        if (!naam || !idactiviteit || !(await activityBelongsToGroup(idactiviteit, idwaarneemgroep))) {
          return res.status(400).json({ error: 'Kies een geldige activiteit en specificatienaam.' });
        }
        const [created] = await db
          .insert(schema.activiteitSpecificaties)
          .values({
            naam,
            idactiviteit,
            afkorting: optionalText(body.afkorting, 50),
            kleur: optionalText(body.kleur, 50),
            actief: true,
          })
          .returning({ id: schema.activiteitSpecificaties.id });
        return res.status(201).json({ success: true, id: created.id });
      }

      if (entity === 'location') {
        const naam = textValue(body.naam, { required: true, max: 255 });
        if (!naam) return res.status(400).json({ error: 'Een locatienaam is verplicht.' });
        const [created] = await db
          .insert(schema.praktijkplannerlocaties)
          .values({
            idwaarneemgroep,
            naam,
            afkorting: optionalText(body.afkorting, 50),
            kleur: optionalText(body.kleur, 50),
            idlocatie: parsePositiveInteger(body.idlocatie),
            actief: true,
          })
          .returning({ id: schema.praktijkplannerlocaties.id });
        return res.status(201).json({ success: true, id: created.id });
      }

      if (entity === 'absenceType' || entity === 'availabilityType') {
        const naam = textValue(body.naam, { required: true, max: 100 });
        const code = textValue(body.code, { required: true, max: 50 })?.toLowerCase();
        if (!naam || !code) return res.status(400).json({ error: 'Naam en code zijn verplicht.' });
        const values = {
          idwaarneemgroep,
          naam,
          code,
          kleur: optionalText(body.kleur, 50),
          icon: optionalText(body.icon, 100),
          actief: true,
        };
        const [created] =
          entity === 'absenceType'
            ? await db.insert(schema.afwezigheidstypen).values(values).returning({ id: schema.afwezigheidstypen.id })
            : await db
                .insert(schema.beschikbaarheidstypen)
                .values({ ...values, type: optionalText(body.type, 30) ?? 'fte' })
                .returning({ id: schema.beschikbaarheidstypen.id });
        return res.status(201).json({ success: true, id: created.id });
      }

      const omschrijving = textValue(body.omschrijving, { required: true, max: 50 });
      if (!omschrijving) return res.status(400).json({ error: 'Een taakomschrijving is verplicht.' });
      const expertise = await resolveOptionalExpertiseId(body.idexpertise, idwaarneemgroep);
      if (!expertise.ok) return res.status(400).json({ error: 'Kies een geldige expertise.' });
      const [created] = await db
        .insert(schema.taaktypen)
        .values({
          id: await nextTaskTypeId(),
          idwaarneemgroep,
          afkorting: optionalText(body.afkorting, 10),
          omschrijving,
          kleur: optionalText(body.kleur, 50),
          idexpertise: expertise.idexpertise,
          nietLocatieGebonden: activeValue(body.nietLocatieGebonden, false),
          verwijderd: 0,
          volgorde: 9999,
        })
        .returning({ id: schema.taaktypen.id });
      return res.status(201).json({ success: true, id: created.id ?? 0 });
    }

    if (!id) return res.status(400).json({ error: 'Een geldige id is verplicht.' });

    if (action === 'archive') {
      if (entity === 'expertise') {
        await db
          .update(schema.expertises)
          .set({ actief: false })
          .where(and(eq(schema.expertises.id, id), eq(schema.expertises.idwaarneemgroep, idwaarneemgroep)));
      } else if (entity === 'activity') {
        await db
          .update(schema.activiteiten)
          .set({ actief: false })
          .where(and(eq(schema.activiteiten.id, id), eq(schema.activiteiten.idwaarneemgroep, idwaarneemgroep)));
      } else if (entity === 'specification') {
        if (!(await specificationBelongsToGroup(id, idwaarneemgroep))) {
          return res.status(404).json({ error: 'Specificatie niet gevonden.' });
        }
        await db
          .update(schema.activiteitSpecificaties)
          .set({ actief: false })
          .where(eq(schema.activiteitSpecificaties.id, id));
      } else if (entity === 'location') {
        await db
          .update(schema.praktijkplannerlocaties)
          .set({ actief: false })
          .where(
            and(
              eq(schema.praktijkplannerlocaties.id, id),
              eq(schema.praktijkplannerlocaties.idwaarneemgroep, idwaarneemgroep)
            )
          );
      } else if (entity === 'absenceType') {
        await db
          .update(schema.afwezigheidstypen)
          .set({ actief: false })
          .where(
            and(
              eq(schema.afwezigheidstypen.id, id),
              eq(schema.afwezigheidstypen.idwaarneemgroep, idwaarneemgroep)
            )
          );
      } else if (entity === 'availabilityType') {
        await db
          .update(schema.beschikbaarheidstypen)
          .set({ actief: false })
          .where(
            and(
              eq(schema.beschikbaarheidstypen.id, id),
              eq(schema.beschikbaarheidstypen.idwaarneemgroep, idwaarneemgroep)
            )
          );
      } else {
        await db
          .update(schema.taaktypen)
          .set({ verwijderd: 1 })
          .where(and(eq(schema.taaktypen.id, id), eq(schema.taaktypen.idwaarneemgroep, idwaarneemgroep)));
      }
      return res.status(200).json({ success: true, id });
    }

    if (entity === 'expertise') {
      const naam = textValue(body.naam, { required: true, max: 255 });
      if (!naam) return res.status(400).json({ error: 'Een expertisenaam is verplicht.' });
      await db
        .update(schema.expertises)
        .set({ naam, afkorting: optionalText(body.afkorting, 50), actief: activeValue(body.actief) })
        .where(and(eq(schema.expertises.id, id), eq(schema.expertises.idwaarneemgroep, idwaarneemgroep)));
    } else if (entity === 'activity') {
      const naam = textValue(body.naam, { required: true, max: 255 });
      if (!naam) return res.status(400).json({ error: 'Een activiteitsnaam is verplicht.' });
      const expertise = await resolveOptionalExpertiseId(body.idexpertise, idwaarneemgroep);
      if (!expertise.ok) return res.status(400).json({ error: 'Kies een geldige expertise.' });
      await db
        .update(schema.activiteiten)
        .set({
          naam,
          idexpertise: expertise.idexpertise,
          afkorting: optionalText(body.afkorting, 50),
          kleur: optionalText(body.kleur, 50),
          icon: optionalText(body.icon, 100),
          actief: activeValue(body.actief),
        })
        .where(and(eq(schema.activiteiten.id, id), eq(schema.activiteiten.idwaarneemgroep, idwaarneemgroep)));
    } else if (entity === 'location') {
      const naam = textValue(body.naam, { required: true, max: 255 });
      if (!naam) return res.status(400).json({ error: 'Een locatienaam is verplicht.' });
      await db
        .update(schema.praktijkplannerlocaties)
        .set({
          naam,
          afkorting: optionalText(body.afkorting, 50),
          kleur: optionalText(body.kleur, 50),
          actief: activeValue(body.actief),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(schema.praktijkplannerlocaties.id, id),
            eq(schema.praktijkplannerlocaties.idwaarneemgroep, idwaarneemgroep)
          )
        );
    } else if (entity === 'absenceType' || entity === 'availabilityType') {
      const naam = textValue(body.naam, { required: true, max: 100 });
      const code = textValue(body.code, { required: true, max: 50 })?.toLowerCase();
      if (!naam || !code) return res.status(400).json({ error: 'Naam en code zijn verplicht.' });
      if (entity === 'absenceType') {
        await db
          .update(schema.afwezigheidstypen)
          .set({
            naam,
            code,
            kleur: optionalText(body.kleur, 50),
            icon: optionalText(body.icon, 100),
            actief: activeValue(body.actief),
          })
          .where(
            and(
              eq(schema.afwezigheidstypen.id, id),
              eq(schema.afwezigheidstypen.idwaarneemgroep, idwaarneemgroep)
            )
          );
      } else {
        await db
          .update(schema.beschikbaarheidstypen)
          .set({
            naam,
            code,
            kleur: optionalText(body.kleur, 50),
            icon: optionalText(body.icon, 100),
            type: optionalText(body.type, 30) ?? 'fte',
            actief: activeValue(body.actief),
          })
          .where(
            and(
              eq(schema.beschikbaarheidstypen.id, id),
              eq(schema.beschikbaarheidstypen.idwaarneemgroep, idwaarneemgroep)
            )
          );
      }
    } else if (entity === 'task') {
      const omschrijving = textValue(body.omschrijving, { required: true, max: 50 });
      if (!omschrijving) return res.status(400).json({ error: 'Een taakomschrijving is verplicht.' });
      const expertise = await resolveOptionalExpertiseId(body.idexpertise, idwaarneemgroep);
      if (!expertise.ok) return res.status(400).json({ error: 'Kies een geldige expertise.' });
      await db
        .update(schema.taaktypen)
        .set({
          omschrijving,
          idexpertise: expertise.idexpertise,
          afkorting: optionalText(body.afkorting, 10),
          kleur: optionalText(body.kleur, 50),
          nietLocatieGebonden: activeValue(body.nietLocatieGebonden, false),
          verwijderd: activeValue(body.actief) ? 0 : 1,
        })
        .where(and(eq(schema.taaktypen.id, id), eq(schema.taaktypen.idwaarneemgroep, idwaarneemgroep)));
    } else {
      const naam = textValue(body.naam, { required: true, max: 255 });
      const idactiviteit = parsePositiveInteger(body.idactiviteit);
      if (
        !naam ||
        !idactiviteit ||
        !(await activityBelongsToGroup(idactiviteit, idwaarneemgroep)) ||
        !(await specificationBelongsToGroup(id, idwaarneemgroep))
      ) {
        return res.status(400).json({ error: 'Kies een geldige activiteit en specificatienaam.' });
      }
      await db
        .update(schema.activiteitSpecificaties)
        .set({
          naam,
          idactiviteit,
          afkorting: optionalText(body.afkorting, 50),
          kleur: optionalText(body.kleur, 50),
          actief: activeValue(body.actief),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.activiteitSpecificaties.id, id));
    }

    return res.status(200).json({ success: true, id });
  } catch (error) {
    console.error('[praktijkplanner/master-data POST]', error);
    return res.status(500).json({ error: 'De beheeractie kon niet worden opgeslagen.' });
  }
}
