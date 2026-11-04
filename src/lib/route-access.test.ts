import { describe, expect, it } from 'vitest';
import {
  getAppSection,
  getPraktijkplannerHomeForRole,
  isAuthenticatedPath,
  isRouteAllowedForRole,
} from './route-access';
import {
  GROEP_ADMINISTRATOR,
  GROEP_DEELNEMER,
  GROEP_SECRETARIS,
} from './roles';

describe('Praktijkplanner route access', () => {
  it('identifies all planner pages as authenticated Praktijkplanner routes', () => {
    expect(isAuthenticatedPath('/praktijkplanner/activiteiten')).toBe(true);
    expect(isAuthenticatedPath('/praktijkplanner/capaciteitsoverzicht')).toBe(true);
    expect(isAuthenticatedPath('/praktijkplanner/beheer')).toBe(true);
    expect(isAuthenticatedPath('/praktijkplanner/waarneemgroep-wijzigen')).toBe(true);
    expect(isAuthenticatedPath('/praktijkplanner/lijst-deelnemers')).toBe(true);
    expect(getAppSection('/praktijkplanner/dokter-afwezigheid')).toBe('praktijkplanner');
    expect(getAppSection('/rooster-inzien')).toBe('doktersdienst');
  });

  it('keeps personal planner routes open to every role', () => {
    for (const role of [GROEP_DEELNEMER, GROEP_SECRETARIS, GROEP_ADMINISTRATOR]) {
      expect(isRouteAllowedForRole('/praktijkplanner/rooster-inzien', role)).toBe(true);
      expect(isRouteAllowedForRole('/praktijkplanner/afwezigheidsplanner-dokter', role)).toBe(true);
      expect(isRouteAllowedForRole('/praktijkplanner/dokter-afwezigheid', role)).toBe(true);
      expect(isRouteAllowedForRole('/praktijkplanner/dokter-activiteiten', role)).toBe(true);
    }
  });

  it('limits group and administration pages by role', () => {
    expect(isRouteAllowedForRole('/praktijkplanner/activiteiten', GROEP_DEELNEMER)).toBe(false);
    expect(isRouteAllowedForRole('/praktijkplanner/beheer', GROEP_DEELNEMER)).toBe(false);
    expect(isRouteAllowedForRole('/praktijkplanner/afwezigheidsplanner', GROEP_DEELNEMER)).toBe(
      false
    );
    expect(isRouteAllowedForRole('/praktijkplanner/activiteiten', GROEP_SECRETARIS)).toBe(true);
    expect(isRouteAllowedForRole('/praktijkplanner/beheer', GROEP_SECRETARIS)).toBe(true);
    expect(isRouteAllowedForRole('/praktijkplanner/capaciteitsplanner', GROEP_SECRETARIS)).toBe(
      true
    );
    expect(
      isRouteAllowedForRole('/praktijkplanner/waarneemgroep-wijzigen', GROEP_SECRETARIS)
    ).toBe(true);
    expect(isRouteAllowedForRole('/praktijkplanner/beheer', GROEP_ADMINISTRATOR)).toBe(true);
  });

  it('picks a role-aware Praktijkplanner home route', () => {
    expect(getPraktijkplannerHomeForRole(GROEP_DEELNEMER)).toBe('/praktijkplanner/rooster-inzien');
    expect(getPraktijkplannerHomeForRole(GROEP_SECRETARIS)).toBe('/praktijkplanner/activiteiten');
    expect(getPraktijkplannerHomeForRole(GROEP_ADMINISTRATOR)).toBe('/praktijkplanner/activiteiten');
  });
});
