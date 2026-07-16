import { describe, expect, it } from 'vitest';
import {
  buildMaterializePlans,
  occurrenceKey,
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
});
