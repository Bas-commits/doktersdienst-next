import { describe, expect, it } from 'vitest';
import {
  getAppSection,
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
    expect(getAppSection('/praktijkplanner/dokter-afwezigheid')).toBe('praktijkplanner');
    expect(getAppSection('/rooster-inzien')).toBe('doktersdienst');
  });

  it('keeps personal planner routes open to every role', () => {
    for (const role of [GROEP_DEELNEMER, GROEP_SECRETARIS, GROEP_ADMINISTRATOR]) {
      expect(isRouteAllowedForRole('/praktijkplanner/activiteiten', role)).toBe(true);
      expect(isRouteAllowedForRole('/praktijkplanner/dokter-afwezigheid', role)).toBe(true);
    }
  });

  it('limits group and administration pages by role', () => {
    expect(
      isRouteAllowedForRole('/praktijkplanner/afwezigheidsplanner', GROEP_DEELNEMER)
    ).toBe(false);
    expect(
      isRouteAllowedForRole('/praktijkplanner/capaciteitsplanner', GROEP_SECRETARIS)
    ).toBe(true);
    expect(isRouteAllowedForRole('/praktijkplanner/beheer', GROEP_SECRETARIS)).toBe(false);
    expect(isRouteAllowedForRole('/praktijkplanner/beheer', GROEP_ADMINISTRATOR)).toBe(true);
  });
});
