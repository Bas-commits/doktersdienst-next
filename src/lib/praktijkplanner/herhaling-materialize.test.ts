import { describe, expect, it } from 'vitest';
import {
  buildMaterializePlans,
  occurrenceKey,
  plannenZonderDiensten,
  templateDayOffset,
  type PlannerTemplate,
} from './herhaling-materialize';

const template = (overrides: Partial<PlannerTemplate> = {}): PlannerTemplate => ({
  datum: '2026-07-13',
  iddagdeel: 1,
  idactiviteit: 10,
  idactiviteitspecificatie: null,
  idplannerlocatie: null,
  idbeschikbaarheidstype: null,
  tasks: [{ idtaaktype: 3, positie: 1 }],
  ...overrides,
});

describe('herhaling-materialize', () => {
  it('computes day offsets from source week', () => {
    expect(templateDayOffset('2026-07-13', '2026-07-13')).toBe(0);
    expect(templateDayOffset('2026-07-15', '2026-07-13')).toBe(2);
  });

  it('builds plans for each target week and template', () => {
    const plans = buildMaterializePlans({
      sourceStart: '2026-07-13',
      targetStarts: ['2026-07-20', '2026-07-27'],
      templates: [
        template({ datum: '2026-07-13', iddagdeel: 1 }),
        template({ datum: '2026-07-14', iddagdeel: 2, tasks: [] }),
      ],
    });
    expect(plans).toHaveLength(4);
    expect(plans.filter((plan) => plan.isBronslot)).toHaveLength(2);
    expect(plans.map((plan) => plan.datum).sort()).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-27',
      '2026-07-28',
    ]);
  });

  it('skips exception keys when building plans', () => {
    const plans = buildMaterializePlans({
      sourceStart: '2026-07-13',
      targetStarts: ['2026-07-20'],
      templates: [
        template({ datum: '2026-07-13', iddagdeel: 1 }),
        template({ datum: '2026-07-13', iddagdeel: 2 }),
      ],
      skipKeys: new Set([occurrenceKey('2026-07-20', 1)]),
    });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ datum: '2026-07-20', iddagdeel: 2 });
  });

  it('laat diensten niet meereizen naar de doelweken', () => {
    const plans = buildMaterializePlans({
      sourceStart: '2026-07-13',
      targetStarts: ['2026-07-20'],
      templates: [
        template({ iddagdeel: 1, tasks: [{ idtaaktype: 3, positie: 1 }] }),
        template({
          iddagdeel: 4,
          idactiviteit: null,
          tasks: [{ idtaaktype: 50, positie: 1 }],
        }),
        template({
          iddagdeel: 2,
          idactiviteit: 10,
          tasks: [
            { idtaaktype: 50, positie: 1 },
            { idtaaktype: 3, positie: 2 },
          ],
        }),
      ],
    });

    const overgebleven = plannenZonderDiensten(plans, new Set([50]));

    // Het dagdeel met alleen een dienst valt weg; het dagdeel met een activiteit blijft,
    // maar zonder de dienst erin.
    expect(overgebleven.map((plan) => plan.iddagdeel).sort()).toEqual([1, 2]);
    expect(overgebleven.flatMap((plan) => plan.tasks.map((taak) => taak.idtaaktype))).toEqual([
      3, 3,
    ]);
  });

  it('laat de plannen ongemoeid als de groep geen diensttaken heeft', () => {
    const plans = buildMaterializePlans({
      sourceStart: '2026-07-13',
      targetStarts: ['2026-07-20'],
      templates: [template()],
    });
    expect(plannenZonderDiensten(plans, new Set())).toBe(plans);
  });
});