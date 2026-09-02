import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { db, schema } from '@/db';
import { loadDaypartTimes } from '@/lib/praktijkplanner/daypart-times-db';
import type { PraktijkplannerMasterData } from '@/types/praktijkplanner';

export async function getPraktijkplannerMasterData(
  idwaarneemgroep: number,
  options: { includeInactive?: boolean } = {}
): Promise<PraktijkplannerMasterData> {
  const includeInactive = options.includeInactive ?? false;
  const expertiseWhere = includeInactive
    ? eq(schema.expertises.idwaarneemgroep, idwaarneemgroep)
    : and(
        eq(schema.expertises.idwaarneemgroep, idwaarneemgroep),
        eq(schema.expertises.actief, true)
      );
  const functieWhere = includeInactive
    ? eq(schema.praktijkplannerfuncties.idwaarneemgroep, idwaarneemgroep)
    : and(
        eq(schema.praktijkplannerfuncties.idwaarneemgroep, idwaarneemgroep),
        eq(schema.praktijkplannerfuncties.actief, true)
      );
  const activityWhere = includeInactive
    ? eq(schema.activiteiten.idwaarneemgroep, idwaarneemgroep)
    : and(
        eq(schema.activiteiten.idwaarneemgroep, idwaarneemgroep),
        eq(schema.activiteiten.actief, true)
      );
  const specificationWhere = includeInactive
    ? eq(schema.activiteiten.idwaarneemgroep, idwaarneemgroep)
    : and(
        eq(schema.activiteiten.idwaarneemgroep, idwaarneemgroep),
        eq(schema.activiteitSpecificaties.actief, true)
      );
  const locationWhere = includeInactive
    ? eq(schema.praktijkplannerlocaties.idwaarneemgroep, idwaarneemgroep)
    : and(
        eq(schema.praktijkplannerlocaties.idwaarneemgroep, idwaarneemgroep),
        eq(schema.praktijkplannerlocaties.actief, true)
      );
  const availabilityWhere = includeInactive
    ? eq(schema.beschikbaarheidstypen.idwaarneemgroep, idwaarneemgroep)
    : and(
        eq(schema.beschikbaarheidstypen.idwaarneemgroep, idwaarneemgroep),
        eq(schema.beschikbaarheidstypen.actief, true)
      );
  const absenceWhere = includeInactive
    ? eq(schema.afwezigheidstypen.idwaarneemgroep, idwaarneemgroep)
    : and(
        eq(schema.afwezigheidstypen.idwaarneemgroep, idwaarneemgroep),
        eq(schema.afwezigheidstypen.actief, true)
      );
  const taskWhere = includeInactive
    ? eq(schema.taaktypen.idwaarneemgroep, idwaarneemgroep)
    : and(
        eq(schema.taaktypen.idwaarneemgroep, idwaarneemgroep),
        or(isNull(schema.taaktypen.verwijderd), eq(schema.taaktypen.verwijderd, 0))
      );

  const [
    dayparts,
    expertiseRows,
    activityRows,
    specificationRows,
    taskRows,
    locationRows,
    availabilityRows,
    absenceRows,
    functieRows,
    schedulableDaypartRows,
    participantSchedulableDaypartRows,
    daypartTimeRows,
  ] = await Promise.all([
    db
      .select({
        id: schema.dagdelen.id,
        naam: schema.dagdelen.naam,
        volgorde: schema.dagdelen.volgorde,
      })
      .from(schema.dagdelen)
      .orderBy(asc(schema.dagdelen.volgorde)),
    db
      .select({
        id: schema.expertises.id,
        naam: schema.expertises.naam,
        afkorting: schema.expertises.afkorting,
        actief: schema.expertises.actief,
      })
      .from(schema.expertises)
      .where(expertiseWhere)
      .orderBy(asc(schema.expertises.naam)),
    db
      .select({
        id: schema.activiteiten.id,
        naam: schema.activiteiten.naam,
        afkorting: schema.activiteiten.afkorting,
        kleur: schema.activiteiten.kleur,
        icon: schema.activiteiten.icon,
        idexpertise: schema.activiteiten.idexpertise,
        actief: schema.activiteiten.actief,
      })
      .from(schema.activiteiten)
      .where(activityWhere)
      .orderBy(asc(schema.activiteiten.naam)),
    db
      .select({
        id: schema.activiteitSpecificaties.id,
        idactiviteit: schema.activiteitSpecificaties.idactiviteit,
        naam: schema.activiteitSpecificaties.naam,
        afkorting: schema.activiteitSpecificaties.afkorting,
        kleur: schema.activiteitSpecificaties.kleur,
        actief: schema.activiteitSpecificaties.actief,
      })
      .from(schema.activiteitSpecificaties)
      .innerJoin(
        schema.activiteiten,
        eq(schema.activiteitSpecificaties.idactiviteit, schema.activiteiten.id)
      )
      .where(specificationWhere)
      .orderBy(asc(schema.activiteitSpecificaties.naam)),
    db
      .select({
        id: schema.taaktypen.id,
        afkorting: schema.taaktypen.afkorting,
        omschrijving: schema.taaktypen.omschrijving,
        kleur: schema.taaktypen.kleur,
        idexpertise: schema.taaktypen.idexpertise,
        nietLocatieGebonden: schema.taaktypen.nietLocatieGebonden,
        inbelbaar: schema.taaktypen.inbelbaar,
        inbelnummer: schema.taaktypen.inbelnummer,
        isDienst: schema.taaktypen.isDienst,
        verwijderd: schema.taaktypen.verwijderd,
      })
      .from(schema.taaktypen)
      .where(taskWhere)
      .orderBy(asc(schema.taaktypen.volgorde), asc(schema.taaktypen.omschrijving)),
    db
      .select({
        id: schema.praktijkplannerlocaties.id,
        naam: schema.praktijkplannerlocaties.naam,
        afkorting: schema.praktijkplannerlocaties.afkorting,
        kleur: schema.praktijkplannerlocaties.kleur,
        actief: schema.praktijkplannerlocaties.actief,
        idlocatie: schema.praktijkplannerlocaties.idlocatie,
      })
      .from(schema.praktijkplannerlocaties)
      .where(locationWhere)
      .orderBy(asc(schema.praktijkplannerlocaties.naam)),
    db
      .select({
        id: schema.beschikbaarheidstypen.id,
        naam: schema.beschikbaarheidstypen.naam,
        code: schema.beschikbaarheidstypen.code,
        kleur: schema.beschikbaarheidstypen.kleur,
        icon: schema.beschikbaarheidstypen.icon,
        type: schema.beschikbaarheidstypen.type,
        actief: schema.beschikbaarheidstypen.actief,
      })
      .from(schema.beschikbaarheidstypen)
      .where(availabilityWhere)
      .orderBy(asc(schema.beschikbaarheidstypen.naam)),
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
      .where(absenceWhere)
      .orderBy(asc(schema.afwezigheidstypen.naam)),
    db
      .select({
        id: schema.praktijkplannerfuncties.id,
        naam: schema.praktijkplannerfuncties.naam,
        actief: schema.praktijkplannerfuncties.actief,
      })
      .from(schema.praktijkplannerfuncties)
      .where(functieWhere)
      .orderBy(asc(schema.praktijkplannerfuncties.naam)),
    db
      .select({
        weekdag: schema.praktijkplannerdagdelen.weekdag,
        iddagdeel: schema.praktijkplannerdagdelen.iddagdeel,
        actief: schema.praktijkplannerdagdelen.actief,
      })
      .from(schema.praktijkplannerdagdelen)
      .where(eq(schema.praktijkplannerdagdelen.idwaarneemgroep, idwaarneemgroep)),
    db
      .select({
        iddeelnemer: schema.praktijkplannerdeelnemerdagdelen.iddeelnemer,
        weekdag: schema.praktijkplannerdeelnemerdagdelen.weekdag,
        iddagdeel: schema.praktijkplannerdeelnemerdagdelen.iddagdeel,
        actief: schema.praktijkplannerdeelnemerdagdelen.actief,
      })
      .from(schema.praktijkplannerdeelnemerdagdelen)
      .where(eq(schema.praktijkplannerdeelnemerdagdelen.idwaarneemgroep, idwaarneemgroep)),
    loadDaypartTimes(idwaarneemgroep),
  ]);

  return {
    dayparts: dayparts
      .filter((row): row is typeof row & { id: number; naam: string; volgorde: number } =>
        row.id != null && row.naam != null && row.volgorde != null
      )
      .map((row) => ({ id: row.id, naam: row.naam, volgorde: row.volgorde })),
    expertises: expertiseRows
      .filter((row): row is typeof row & { id: number; naam: string; actief: boolean } =>
        row.id != null && row.naam != null && row.actief != null
      )
      .map((row) => ({ id: row.id, naam: row.naam, afkorting: row.afkorting, actief: row.actief })),
    activities: activityRows
      .filter(
        (row): row is typeof row & { id: number; naam: string; actief: boolean } =>
          row.id != null && row.naam != null && row.actief != null
      )
      .map((row) => ({
        id: row.id,
        naam: row.naam,
        afkorting: row.afkorting,
        kleur: row.kleur,
        icon: row.icon,
        idexpertise: row.idexpertise,
        actief: row.actief,
      })),
    specifications: specificationRows
      .filter(
        (row): row is typeof row & { id: number; idactiviteit: number; naam: string; actief: boolean } =>
          row.id != null && row.idactiviteit != null && row.naam != null && row.actief != null
      )
      .map((row) => ({
        id: row.id,
        idactiviteit: row.idactiviteit,
        naam: row.naam,
        afkorting: row.afkorting,
        kleur: row.kleur,
        actief: row.actief,
      })),
    tasks: taskRows
      .filter((row): row is typeof row & { id: number } => row.id != null)
      .map((row) => ({
        id: row.id,
        afkorting: row.afkorting,
        omschrijving: row.omschrijving,
        kleur: row.kleur,
        idexpertise: row.idexpertise,
        // De kolom komt uit het oude systeem en staat daar meestal leeg. Leeg betekent gewoon
        // locatiegebonden, dus dat is hier false en niet null.
        nietLocatieGebonden: row.nietLocatieGebonden === true,
        // Zelfde verhaal als hierboven: leeg betekent niet inbelbaar.
        inbelbaar: row.inbelbaar === true,
        inbelnummer: row.inbelnummer ?? null,
        isDienst: row.isDienst === true,
        actief: row.verwijderd !== 1,
      })),
    locations: locationRows
      .filter((row): row is typeof row & { id: number; naam: string; actief: boolean } =>
        row.id != null && row.naam != null && row.actief != null
      )
      .map((row) => ({
        id: row.id,
        naam: row.naam,
        afkorting: row.afkorting,
        kleur: row.kleur,
        actief: row.actief,
        idlocatie: row.idlocatie,
      })),
    availabilityTypes: availabilityRows
      .filter((row): row is typeof row & { id: number; naam: string; code: string; type: string; actief: boolean } =>
        row.id != null && row.naam != null && row.code != null && row.type != null && row.actief != null
      )
      .map((row) => ({
        id: row.id,
        naam: row.naam,
        code: row.code,
        kleur: row.kleur,
        icon: row.icon,
        type: row.type,
        actief: row.actief,
      })),
    absenceTypes: absenceRows
      .filter((row): row is typeof row & { id: number; naam: string; code: string; actief: boolean } =>
        row.id != null && row.naam != null && row.code != null && row.actief != null
      )
      .map((row) => ({
        id: row.id,
        naam: row.naam,
        code: row.code,
        kleur: row.kleur,
        icon: row.icon,
        actief: row.actief,
      })),
    functies: functieRows
      .filter((row): row is typeof row & { id: number; naam: string; actief: boolean } =>
        row.id != null && row.naam != null && row.actief != null
      )
      .map((row) => ({ id: row.id, naam: row.naam, actief: row.actief })),
    daypartTimes: daypartTimeRows,
    schedulableDayparts: schedulableDaypartRows
      .filter(
        (row): row is typeof row & { weekdag: number; iddagdeel: number; actief: boolean } =>
          row.weekdag != null && row.iddagdeel != null && row.actief != null
      )
      .map((row) => ({
        weekdag: row.weekdag,
        iddagdeel: row.iddagdeel,
        actief: row.actief,
      })),
    participantSchedulableDayparts: participantSchedulableDaypartRows
      .filter(
        (
          row
        ): row is typeof row & {
          iddeelnemer: number;
          weekdag: number;
          iddagdeel: number;
          actief: boolean;
        } =>
          row.iddeelnemer != null &&
          row.weekdag != null &&
          row.iddagdeel != null &&
          row.actief != null
      )
      .map((row) => ({
        iddeelnemer: row.iddeelnemer,
        weekdag: row.weekdag,
        iddagdeel: row.iddagdeel,
        actief: row.actief,
      })),
  };
}
