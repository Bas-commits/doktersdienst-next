import { addDays } from '@/lib/praktijkplanner/dates';

export type PlannerTemplate = {
  datum: string;
  iddagdeel: number;
  idactiviteit: number | null;
  idactiviteitspecificatie: number | null;
  idplannerlocatie: number | null;
  idbeschikbaarheidstype: number | null;
  tasks: Array<{ idtaaktype: number; positie: number }>;
};

export type MaterializeSlotPlan = {
  datum: string;
  iddagdeel: number;
  idactiviteit: number | null;
  idactiviteitspecificatie: number | null;
  idplannerlocatie: number | null;
  idbeschikbaarheidstype: number | null;
  tasks: Array<{ idtaaktype: number; positie: number }>;
  isBronslot: boolean;
  targetStart: string;
};

export function occurrenceKey(datum: string, iddagdeel: number): string {
  return `${datum}:${iddagdeel}`;
}

export function templateDayOffset(templateDatum: string, sourceStart: string): number {
  return Math.round(
    (new Date(`${templateDatum}T12:00:00`).getTime() -
      new Date(`${sourceStart}T12:00:00`).getTime()) /
      (24 * 60 * 60 * 1000)
  );
}

/** Build planning rows to insert, skipping exception keys. */
export function buildMaterializePlans(input: {
  sourceStart: string;
  targetStarts: string[];
  templates: PlannerTemplate[];
  skipKeys?: ReadonlySet<string>;
}): MaterializeSlotPlan[] {
  const skip = input.skipKeys ?? new Set<string>();
  const plans: MaterializeSlotPlan[] = [];
  for (const targetStart of input.targetStarts) {
    for (const template of input.templates) {
      const offset = templateDayOffset(template.datum, input.sourceStart);
      const datum = addDays(targetStart, offset);
      const key = occurrenceKey(datum, template.iddagdeel);
      if (skip.has(key)) continue;
      plans.push({
        datum,
        iddagdeel: template.iddagdeel,
        idactiviteit: template.idactiviteit,
        idactiviteitspecificatie: template.idactiviteitspecificatie,
        idplannerlocatie: template.idplannerlocatie,
        idbeschikbaarheidstype: template.idbeschikbaarheidstype,
        tasks: template.tasks,
        isBronslot: targetStart === input.targetStarts[0],
        targetStart,
      });
    }
  }
  return plans;
}
