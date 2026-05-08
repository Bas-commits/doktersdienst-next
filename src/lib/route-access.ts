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
] as const;

export const SECRETARIS_ROUTES = [
  '/waarneemgroep-wijzigen',
  '/waarneemgroep-gegevens',
  '/deelnemer-toevoegen',
  '/bestaande-toevoegen',
  '/lijst-deelnemers',
] as const;

export const ADMIN_ROUTES = [
  '/diensten-toevoegen',
  '/regio-toevoegen',
  '/waarneemgroep-toevoegen',
  '/vakanties',
  '/rollen-afmelden',
  '/deelnemers-verwijderen',
] as const;

export const SHARED_AUTHENTICATED_ROUTES = ['/dashboard', '/mijn-gegevens'] as const;

export const AUTHENTICATED_PATHS = [
  ...SHARED_AUTHENTICATED_ROUTES,
  ...MAIN_ROUTES,
  ...SECRETARIS_ROUTES,
  ...ADMIN_ROUTES,
] as const;

const MAIN_ROUTE_SET = new Set<string>(MAIN_ROUTES);
const SECRETARIS_ROUTE_SET = new Set<string>(SECRETARIS_ROUTES);
const ADMIN_ROUTE_SET = new Set<string>(ADMIN_ROUTES);
const AUTHENTICATED_ROUTE_SET = new Set<string>(AUTHENTICATED_PATHS);

export function isAuthenticatedPath(pathname: string): boolean {
  return AUTHENTICATED_ROUTE_SET.has(pathname);
}

export function isRouteAllowedForRole(pathname: string, roleTier: RoleTier): boolean {
  if (MAIN_ROUTE_SET.has(pathname)) return true;
  if (SECRETARIS_ROUTE_SET.has(pathname)) return hasSecretarisAccess(roleTier);
  if (ADMIN_ROUTE_SET.has(pathname)) return hasAdminAccess(roleTier);

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
