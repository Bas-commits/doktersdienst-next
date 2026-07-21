import {
  GROEP_ADMINISTRATOR,
  GROEP_DEELNEMER,
  GROEP_SECRETARIS,
  hasAdminAccess,
  hasSecretarisAccess,
  type RoleTier,
} from '@/lib/roles';

export const MAIN_ROUTES = [
  '/rooster-inzien',
  '/voorkeuren',
  '/rooster-maken-secretaris',
  '/overnames',
  '/urentelling',
  '/locaties',
] as const;

export const SECRETARIS_ROUTES = [
  '/waarneemgroep-wijzigen',
  '/waarneemgroep-gegevens',
  '/deelnemer-toevoegen',
  '/bestaande-toevoegen',
  '/lijst-deelnemers',
  '/gesprekken',
] as const;

export const ADMIN_ROUTES = [
  '/diensten-toevoegen',
  '/regio-toevoegen',
  '/waarneemgroep-toevoegen',
  '/vakanties',
  '/rollen-afmelden',
  '/deelnemers-verwijderen',
] as const;

/** Pages that every active Praktijkplanner participant can open. */
export const PRAKTIJKPLANNER_DEELNEMER_ROUTES = [
  '/praktijkplanner',
  '/praktijkplanner/rooster-inzien',
  '/praktijkplanner/afwezigheidsplanner-dokter',
  '/praktijkplanner/dokter-activiteiten',
  '/praktijkplanner/dokter-afwezigheid',
] as const;

/** Group-wide operational planner pages for secretarissen and administrators. */
export const PRAKTIJKPLANNER_SECRETARIS_ROUTES = [
  '/praktijkplanner/activiteiten',
  '/praktijkplanner/afwezigheidsplanner',
  '/praktijkplanner/capaciteitsplanner',
  '/praktijkplanner/capaciteitsoverzicht',
  '/praktijkplanner/beheer',
  '/praktijkplanner/waarneemgroep-wijzigen',
  '/praktijkplanner/lijst-deelnemers',
] as const;

export const SHARED_AUTHENTICATED_ROUTES = ['/dashboard', '/mijn-gegevens'] as const;

export const AUTHENTICATED_PATHS = [
  ...SHARED_AUTHENTICATED_ROUTES,
  ...MAIN_ROUTES,
  ...SECRETARIS_ROUTES,
  ...ADMIN_ROUTES,
  ...PRAKTIJKPLANNER_DEELNEMER_ROUTES,
  ...PRAKTIJKPLANNER_SECRETARIS_ROUTES,
] as const;

const MAIN_ROUTE_SET = new Set<string>(MAIN_ROUTES);
const SECRETARIS_ROUTE_SET = new Set<string>(SECRETARIS_ROUTES);
const ADMIN_ROUTE_SET = new Set<string>(ADMIN_ROUTES);
const PRAKTIJKPLANNER_DEELNEMER_ROUTE_SET = new Set<string>(PRAKTIJKPLANNER_DEELNEMER_ROUTES);
const PRAKTIJKPLANNER_SECRETARIS_ROUTE_SET = new Set<string>(PRAKTIJKPLANNER_SECRETARIS_ROUTES);
const AUTHENTICATED_ROUTE_SET = new Set<string>(AUTHENTICATED_PATHS);

export type AppSection = 'doktersdienst' | 'praktijkplanner';

export function isAuthenticatedPath(pathname: string): boolean {
  return AUTHENTICATED_ROUTE_SET.has(pathname);
}

export function getAppSection(pathname: string): AppSection {
  return pathname === '/praktijkplanner' || pathname.startsWith('/praktijkplanner/')
    ? 'praktijkplanner'
    : 'doktersdienst';
}

export function isPraktijkplannerPath(pathname: string): boolean {
  return getAppSection(pathname) === 'praktijkplanner';
}

export function isRouteAllowedForRole(pathname: string, roleTier: RoleTier): boolean {
  if (MAIN_ROUTE_SET.has(pathname)) return true;
  if (SECRETARIS_ROUTE_SET.has(pathname)) return hasSecretarisAccess(roleTier);
  if (ADMIN_ROUTE_SET.has(pathname)) return hasAdminAccess(roleTier);
  if (PRAKTIJKPLANNER_DEELNEMER_ROUTE_SET.has(pathname)) return true;
  if (PRAKTIJKPLANNER_SECRETARIS_ROUTE_SET.has(pathname)) return hasSecretarisAccess(roleTier);

  return true;
}

/** Default landing page when opening or switching into Praktijkplanner. */
export function getPraktijkplannerHomeForRole(roleTier: RoleTier): string {
  return hasSecretarisAccess(roleTier)
    ? '/praktijkplanner/activiteiten'
    : '/praktijkplanner/rooster-inzien';
}

export function getDefaultRedirectForRole(roleTier: RoleTier): string {
  if (roleTier === GROEP_ADMINISTRATOR) return '/rooster-inzien';
  if (roleTier === GROEP_SECRETARIS) return '/rooster-inzien';
  return '/rooster-inzien';
}

export function getRoleTierLabel(roleTier: RoleTier): 'deelnemer' | 'secretaris' | 'admin' {
  if (roleTier === GROEP_ADMINISTRATOR) return 'admin';
  if (roleTier === GROEP_SECRETARIS) return 'secretaris';
  return 'deelnemer';
}

export const DEFAULT_ROLE_TIER = GROEP_DEELNEMER;
