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
  '/praktijkplanner/activiteiten',
  '/praktijkplanner/afwezigheidsplanner-dokter',
  '/praktijkplanner/dokter-activiteiten',
  '/praktijkplanner/dokter-afwezigheid',
] as const;

/** Group-wide operational planner pages for secretarissen and administrators. */
export const PRAKTIJKPLANNER_SECRETARIS_ROUTES = [
  '/praktijkplanner/afwezigheidsplanner',
  '/praktijkplanner/capaciteitsplanner',
  '/praktijkplanner/capaciteitsoverzicht',
] as const;

/** Master data is intentionally global-admin-only. */
export const PRAKTIJKPLANNER_ADMIN_ROUTES = ['/praktijkplanner/beheer'] as const;

export const SHARED_AUTHENTICATED_ROUTES = ['/dashboard', '/mijn-gegevens'] as const;

export const AUTHENTICATED_PATHS = [
  ...SHARED_AUTHENTICATED_ROUTES,
  ...MAIN_ROUTES,
  ...SECRETARIS_ROUTES,
  ...ADMIN_ROUTES,
  ...PRAKTIJKPLANNER_DEELNEMER_ROUTES,
  ...PRAKTIJKPLANNER_SECRETARIS_ROUTES,
  ...PRAKTIJKPLANNER_ADMIN_ROUTES,
] as const;

const MAIN_ROUTE_SET = new Set<string>(MAIN_ROUTES);
const SECRETARIS_ROUTE_SET = new Set<string>(SECRETARIS_ROUTES);
const ADMIN_ROUTE_SET = new Set<string>(ADMIN_ROUTES);
const PRAKTIJKPLANNER_DEELNEMER_ROUTE_SET = new Set<string>(PRAKTIJKPLANNER_DEELNEMER_ROUTES);
const PRAKTIJKPLANNER_SECRETARIS_ROUTE_SET = new Set<string>(PRAKTIJKPLANNER_SECRETARIS_ROUTES);
const PRAKTIJKPLANNER_ADMIN_ROUTE_SET = new Set<string>(PRAKTIJKPLANNER_ADMIN_ROUTES);
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
  if (PRAKTIJKPLANNER_ADMIN_ROUTE_SET.has(pathname)) return hasAdminAccess(roleTier);

  return true;
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
