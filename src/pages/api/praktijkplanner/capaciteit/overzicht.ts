import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { compareCapacity } from '@/lib/praktijkplanner/capacity';
import {
  datesBetweenInclusive,
  isIsoDate,
  parsePositiveInteger,
  startOfIsoWeek,
  weekdayFromIsoDate,
} from '@/lib/praktijkplanner/dates';

type Comparison = ReturnType<typeof compareCapacity>;
type OverviewCell = {
  datum: string;
  iddagdeel: number;
  dagdeel: string;
  /** De naam van het regime dat deze week geldt, of leeg als de normale week geldt. */
  regime: string | null;
  totaal: Comparison;
  expertises: Comparison[];
  taken: Comparison[];
  activiteiten: Comparison[];
  specificaties: Comparison[];
};
type Data = { cells: OverviewCell[] } | { error: string };

function oneQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function countsToComparisons(
  requirements: Array<{ id: number; aantal: number }>,
  actual: Map<number, number>,
  labels: Map<number, { label: string; kleur: string | null }>,
  keyPrefix: string
) {
  return requirements.map((requirement) => {
    const display = labels.get(requirement.id);
    return compareCapacity({
      key: `${keyPrefix}:${requirement.id}`,
      label: display?.label ?? `Onbekend ${requirement.id}`,
      gepland: actual.get(requirement.id) ?? 0,
      benodigd: requirement.aantal,
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessResult = await resolvePraktijkplannerAccess(
    req,
    oneQueryValue(req.query.idwaarneemgroep),
    'capaciteit:read'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  const idplannerlocatie = parsePositiveInteger(oneQueryValue(req.query.idplannerlocatie));
  const start = oneQueryValue(req.query.start);
  const end = oneQueryValue(req.query.end);
  if (!idplannerlocatie || !isIsoDate(start) || !isIsoDate(end) || start > end) {
    return res.status(400).json({ error: 'Kies een locatie en geldig datumbereik.' });
  }
  if (datesBetweenInclusive(start, end).length > 31) {
    return res.status(400).json({ error: 'Een capaciteitsoverzicht kan maximaal 31 dagen tonen.' });
  }

  try {
    const [location, templates, dayparts, regimeWeken] = await Promise.all([
      db
        .select({ id: schema.praktijkplannerlocaties.id })
        .from(schema.praktijkplannerlocaties)
        .where(
          and(
            eq(schema.praktijkplannerlocaties.id, idplannerlocatie),
            eq(schema.praktijkplannerlocaties.idwaarneemgroep, accessResult.access.idwaarneemgroep)
          )
        )
        .limit(1),
      db
        .select({
          id: schema.capaciteitsjablonen.id,
          weekdag: schema.capaciteitsjablonen.weekdag,
          iddagdeel: schema.capaciteitsjablonen.iddagdeel,
          idregime: schema.capaciteitsjablonen.idregime,
          idplannerlocatie: schema.capaciteitsjablonen.idplannerlocatie,
          aantalDeelnemers: schema.capaciteitsjablonen.aantalDeelnemers,
        })
        .from(schema.capaciteitsjablonen)
        // Ook de rijen zonder locatie: dat zijn de eisen voor taken die overal mogen gebeuren.
        .where(
          and(
            eq(schema.capaciteitsjablonen.idwaarneemgroep, accessResult.access.idwaarneemgroep),
            or(
              eq(schema.capaciteitsjablonen.idplannerlocatie, idplannerlocatie),
              isNull(schema.capaciteitsjablonen.idplannerlocatie)
            )
          )
        ),
      db
        .select({ id: schema.dagdelen.id, naam: schema.dagdelen.naam, volgorde: schema.dagdelen.volgorde })
        .from(schema.dagdelen),
      // Vanaf de maandag van de eerste dag, want een bereik begint zelden op een maandag en de
      // week eromheen bepaalt wel welk regime die dagen gelden.
      db
        .select({
          maandag: schema.capaciteitsregimeweken.maandag,
          idregime: schema.capaciteitsregimeweken.idregime,
          naam: schema.capaciteitsregimes.naam,
        })
        .from(schema.capaciteitsregimeweken)
        .innerJoin(
          schema.capaciteitsregimes,
          eq(schema.capaciteitsregimeweken.idregime, schema.capaciteitsregimes.id)
        )
        .where(
          and(
            eq(schema.capaciteitsregimeweken.idwaarneemgroep, accessResult.access.idwaarneemgroep),
            gte(schema.capaciteitsregimeweken.maandag, startOfIsoWeek(start)),
            lte(schema.capaciteitsregimeweken.maandag, end)
          )
        ),
    ]);
    if (!location[0]?.id) return res.status(400).json({ error: 'De plannerlocatie bestaat niet.' });

    const templateIds = templates.map((template) => template.id).filter((id): id is number => id != null);
    const [templateExpertises, templateTasks, templateActivities, templateSpecifications, planningRows, absenceRows] =
      await Promise.all([
        templateIds.length
          ? db
              .select({
                idcapaciteitsjabloon: schema.capaciteitsjabloonexpertises.idcapaciteitsjabloon,
                id: schema.capaciteitsjabloonexpertises.idexpertise,
                aantal: schema.capaciteitsjabloonexpertises.aantal,
              })
              .from(schema.capaciteitsjabloonexpertises)
              .where(inArray(schema.capaciteitsjabloonexpertises.idcapaciteitsjabloon, templateIds))
          : Promise.resolve([]),
        templateIds.length
          ? db
              .select({
                idcapaciteitsjabloon: schema.capaciteitsjabloontaken.idcapaciteitsjabloon,
                id: schema.capaciteitsjabloontaken.idtaaktype,
                aantal: schema.capaciteitsjabloontaken.aantal,
              })
              .from(schema.capaciteitsjabloontaken)
              .where(inArray(schema.capaciteitsjabloontaken.idcapaciteitsjabloon, templateIds))
          : Promise.resolve([]),
        templateIds.length
          ? db
              .select({
                idcapaciteitsjabloon: schema.capaciteitsjabloonactiviteiten.idcapaciteitsjabloon,
                id: schema.capaciteitsjabloonactiviteiten.idactiviteit,
                aantal: schema.capaciteitsjabloonactiviteiten.aantal,
              })
              .from(schema.capaciteitsjabloonactiviteiten)
              .where(inArray(schema.capaciteitsjabloonactiviteiten.idcapaciteitsjabloon, templateIds))
          : Promise.resolve([]),
        templateIds.length
          ? db
              .select({
                idcapaciteitsjabloon: schema.capaciteitsjabloonspecificaties.idcapaciteitsjabloon,
                id: schema.capaciteitsjabloonspecificaties.idactiviteitspecificatie,
                aantal: schema.capaciteitsjabloonspecificaties.aantal,
              })
              .from(schema.capaciteitsjabloonspecificaties)
              .where(inArray(schema.capaciteitsjabloonspecificaties.idcapaciteitsjabloon, templateIds))
          : Promise.resolve([]),
        db
          .select({
            id: schema.planning.id,
            iddeelnemer: schema.planning.iddeelnemer,
            datum: schema.planning.datum,
            iddagdeel: schema.planning.iddagdeel,
            idactiviteit: schema.planning.idactiviteit,
            idactiviteitspecificatie: schema.planning.idactiviteitspecificatie,
            idplannerlocatie: schema.planning.idplannerlocatie,
          })
          .from(schema.planning)
          // Zonder locatiefilter: een taak die overal mag gebeuren telt over de hele groep, en
          // dan tellen ook de regels mee waar helemaal geen locatie op staat. Op de locatie
          // wordt hieronder in het geheugen gefilterd.
          .where(
            and(
              eq(schema.planning.idwaarneemgroep, accessResult.access.idwaarneemgroep),
              gte(schema.planning.datum, start),
              lte(schema.planning.datum, end)
            )
          ),
        db
          .select({
            iddeelnemer: schema.planningafwezigheden.iddeelnemer,
            datum: schema.planningafwezigheden.datum,
            iddagdeel: schema.planningafwezigheden.iddagdeel,
          })
          .from(schema.planningafwezigheden)
          .where(
            and(
              eq(schema.planningafwezigheden.idwaarneemgroep, accessResult.access.idwaarneemgroep),
              gte(schema.planningafwezigheden.datum, start),
              lte(schema.planningafwezigheden.datum, end)
            )
          ),
      ]);

    const planningIds = planningRows.map((row) => row.id).filter((id): id is number => id != null);
    const participantIds = planningRows
      .map((row) => row.iddeelnemer)
      .filter((id): id is number => id != null);
    const [planningTasks, participantExpertises, expertiseRows, taskRows, activityRows, specificationRows] =
      await Promise.all([
        planningIds.length
          ? db
              .select({
                idplanning: schema.planningtaak.idplanning,
                idtaaktype: schema.planningtaak.idtaaktype,
              })
              .from(schema.planningtaak)
              .where(inArray(schema.planningtaak.idplanning, planningIds))
          : Promise.resolve([]),
        participantIds.length
          ? db
              .select({
                iddeelnemer: schema.deelnemerexpertises.iddeelnemer,
                idexpertise: schema.deelnemerexpertises.idexpertise,
              })
              .from(schema.deelnemerexpertises)
              .where(inArray(schema.deelnemerexpertises.iddeelnemer, [...new Set(participantIds)]))
          : Promise.resolve([]),
        db
          .select({ id: schema.expertises.id, naam: schema.expertises.naam, afkorting: schema.expertises.afkorting })
          .from(schema.expertises)
          .where(eq(schema.expertises.idwaarneemgroep, accessResult.access.idwaarneemgroep)),
        db
          .select({ id: schema.taaktypen.id, naam: schema.taaktypen.omschrijving, afkorting: schema.taaktypen.afkorting })
          .from(schema.taaktypen)
          .where(eq(schema.taaktypen.idwaarneemgroep, accessResult.access.idwaarneemgroep)),
        db
          .select({ id: schema.activiteiten.id, naam: schema.activiteiten.naam, afkorting: schema.activiteiten.afkorting })
          .from(schema.activiteiten)
          .where(eq(schema.activiteiten.idwaarneemgroep, accessResult.access.idwaarneemgroep)),
        db
          .select({
            id: schema.activiteitSpecificaties.id,
            naam: schema.activiteitSpecificaties.naam,
            afkorting: schema.activiteitSpecificaties.afkorting,
          })
          .from(schema.activiteitSpecificaties)
          .innerJoin(
            schema.activiteiten,
            eq(schema.activiteitSpecificaties.idactiviteit, schema.activiteiten.id)
          )
          .where(eq(schema.activiteiten.idwaarneemgroep, accessResult.access.idwaarneemgroep)),
      ]);

    const requirementsByTemplate = <T extends { idcapaciteitsjabloon: number | null; id: number | null; aantal: number | null }>(
      rows: T[]
    ) => {
      const map = new Map<number, Array<{ id: number; aantal: number }>>();
      for (const row of rows) {
        if (row.idcapaciteitsjabloon == null || row.id == null || row.aantal == null) continue;
        const entries = map.get(row.idcapaciteitsjabloon) ?? [];
        entries.push({ id: row.id, aantal: row.aantal });
        map.set(row.idcapaciteitsjabloon, entries);
      }
      return map;
    };
    // Het regime hoort bij de sleutel, want dezelfde maandagochtend bestaat nu een keer voor de
    // normale week en een keer voor elk regime.
    const bruikbareTemplates = templates.filter(
      (template): template is typeof template & { id: number; weekdag: number; iddagdeel: number; aantalDeelnemers: number } =>
        template.id != null &&
        template.weekdag != null &&
        template.iddagdeel != null &&
        template.aantalDeelnemers != null
    );
    const templateByKey = new Map(
      bruikbareTemplates
        .filter((template) => template.idplannerlocatie != null)
        .map((template) => [
          `${template.idregime ?? 'normaal'}:${template.weekdag}:${template.iddagdeel}`,
          template,
        ])
    );
    const groepTemplateByKey = new Map(
      bruikbareTemplates
        .filter((template) => template.idplannerlocatie == null)
        .map((template) => [
          `${template.idregime ?? 'normaal'}:${template.weekdag}:${template.iddagdeel}`,
          template,
        ])
    );
    const regimeByWeek = new Map(
      regimeWeken
        .filter((week): week is typeof week & { maandag: string; idregime: number; naam: string } =>
          week.maandag != null && week.idregime != null && week.naam != null
        )
        .map((week) => [week.maandag, { id: week.idregime, naam: week.naam }])
    );
    const absenceKeys = new Set(
      absenceRows
        .filter(
          (row): row is typeof row & { iddeelnemer: number; datum: string; iddagdeel: number } =>
            row.iddeelnemer != null && row.datum != null && row.iddagdeel != null
        )
        .map((row) => `${row.iddeelnemer}:${row.datum}:${row.iddagdeel}`)
    );
    const tasksByPlanning = new Map<number, number[]>();
    for (const task of planningTasks) {
      if (task.idplanning == null || task.idtaaktype == null) continue;
      const entries = tasksByPlanning.get(task.idplanning) ?? [];
      entries.push(task.idtaaktype);
      tasksByPlanning.set(task.idplanning, entries);
    }
    const expertiseByParticipant = new Map<number, number[]>();
    for (const item of participantExpertises) {
      if (item.iddeelnemer == null || item.idexpertise == null) continue;
      const entries = expertiseByParticipant.get(item.iddeelnemer) ?? [];
      entries.push(item.idexpertise);
      expertiseByParticipant.set(item.iddeelnemer, entries);
    }
    const labels = (rows: Array<{ id: number | null; naam: string | null; afkorting: string | null }>) =>
      new Map(
        rows
          .filter((row): row is typeof row & { id: number; naam: string } => row.id != null && row.naam != null)
          .map((row) => [row.id, { label: row.afkorting || row.naam, kleur: null }])
      );
    const expertiseLabels = labels(expertiseRows);
    const taskLabels = labels(taskRows);
    const groepTaskLabels = new Map(
      [...taskLabels].map(([id, waarde]) => [id, { ...waarde, label: `${waarde.label} (groep)` }])
    );
    const activityLabels = labels(activityRows);
    const specificationLabels = labels(specificationRows);
    const requiredExpertises = requirementsByTemplate(templateExpertises);
    const requiredTasks = requirementsByTemplate(templateTasks);
    const requiredActivities = requirementsByTemplate(templateActivities);
    const requiredSpecifications = requirementsByTemplate(templateSpecifications);
    const daypartList = dayparts
      .filter((daypart): daypart is typeof daypart & { id: number; naam: string; volgorde: number } =>
        daypart.id != null && daypart.naam != null && daypart.volgorde != null
      )
      .sort((a, b) => a.volgorde - b.volgorde);

    const slotsByDateDaypart = new Map<string, typeof planningRows>();
    for (const slot of planningRows) {
      if (slot.datum == null || slot.iddagdeel == null) continue;
      const key = `${slot.datum}:${slot.iddagdeel}`;
      const entries = slotsByDateDaypart.get(key) ?? [];
      entries.push(slot);
      slotsByDateDaypart.set(key, entries);
    }

    const cells: OverviewCell[] = [];
    for (const datum of datesBetweenInclusive(start, end)) {
      for (const daypart of daypartList) {
        const regime = regimeByWeek.get(startOfIsoWeek(datum)) ?? null;
        // Een regime vervangt de normale week. Heeft het geen rij voor dit dagdeel, dan wordt er
        // niets geeist; terugvallen op de normale week zou juist de eis terugbrengen die de
        // secretaris daar bewust heeft weggehaald.
        const template = templateByKey.get(
          `${regime?.id ?? 'normaal'}:${weekdayFromIsoDate(datum)}:${daypart.id}`
        );
        const groepTemplate = groepTemplateByKey.get(
          `${regime?.id ?? 'normaal'}:${weekdayFromIsoDate(datum)}:${daypart.id}`
        );
        const aanwezigeSlots = (slotsByDateDaypart.get(`${datum}:${daypart.id}`) ?? []).filter(
          (slot) =>
            slot.iddeelnemer != null &&
            !absenceKeys.has(`${slot.iddeelnemer}:${datum}:${daypart.id}`)
        );
        const activeSlots = aanwezigeSlots.filter(
          (slot) => slot.idplannerlocatie === idplannerlocatie
        );
        const expertiseCounts = new Map<number, number>();
        const taskCounts = new Map<number, number>();
        // Over de hele groep, dus ook de deelnemers zonder locatie en die op een andere locatie.
        const groepTaskCounts = new Map<number, number>();
        for (const slot of aanwezigeSlots) {
          if (slot.id == null) continue;
          for (const id of tasksByPlanning.get(slot.id) ?? []) {
            groepTaskCounts.set(id, (groepTaskCounts.get(id) ?? 0) + 1);
          }
        }
        const activityCounts = new Map<number, number>();
        const specificationCounts = new Map<number, number>();
        for (const slot of activeSlots) {
          if (slot.iddeelnemer != null) {
            for (const id of expertiseByParticipant.get(slot.iddeelnemer) ?? []) {
              expertiseCounts.set(id, (expertiseCounts.get(id) ?? 0) + 1);
            }
          }
          if (slot.idactiviteit != null) {
            activityCounts.set(slot.idactiviteit, (activityCounts.get(slot.idactiviteit) ?? 0) + 1);
          }
          if (slot.idactiviteitspecificatie != null) {
            specificationCounts.set(
              slot.idactiviteitspecificatie,
              (specificationCounts.get(slot.idactiviteitspecificatie) ?? 0) + 1
            );
          }
          if (slot.id != null) {
            for (const id of tasksByPlanning.get(slot.id) ?? []) {
              taskCounts.set(id, (taskCounts.get(id) ?? 0) + 1);
            }
          }
        }
        const templateId = template?.id;
        cells.push({
          datum,
          iddagdeel: daypart.id,
          dagdeel: daypart.naam,
          regime: regime?.naam ?? null,
          totaal: compareCapacity({
            key: `totaal:${datum}:${daypart.id}`,
            label: 'Aantal deelnemers',
            gepland: activeSlots.length,
            benodigd: template?.aantalDeelnemers ?? 0,
          }),
          expertises: countsToComparisons(
            templateId != null ? requiredExpertises.get(templateId) ?? [] : [],
            expertiseCounts,
            expertiseLabels,
            'expertise'
          ),
          taken: [
            ...countsToComparisons(
              templateId != null ? requiredTasks.get(templateId) ?? [] : [],
              taskCounts,
              taskLabels,
              'taak'
            ),
            // De groepseisen erachter, met "groep" in het label. Zonder dat zou de planner niet
            // kunnen zien waarom deze regel op elke locatie hetzelfde staat.
            ...countsToComparisons(
              groepTemplate?.id != null ? requiredTasks.get(groepTemplate.id) ?? [] : [],
              groepTaskCounts,
              groepTaskLabels,
              'groepstaak'
            ),
          ],
          activiteiten: countsToComparisons(
            templateId != null ? requiredActivities.get(templateId) ?? [] : [],
            activityCounts,
            activityLabels,
            'activiteit'
          ),
          specificaties: countsToComparisons(
            templateId != null ? requiredSpecifications.get(templateId) ?? [] : [],
            specificationCounts,
            specificationLabels,
            'specificatie'
          ),
        });
      }
    }

    return res.status(200).json({ cells });
  } catch (error) {
    console.error('[praktijkplanner/capaciteit/overzicht]', error);
    return res.status(500).json({ error: 'Het capaciteitsoverzicht kon niet worden geladen.' });
  }
}
