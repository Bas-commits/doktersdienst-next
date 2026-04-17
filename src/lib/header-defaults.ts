import type { WaarneemgroepItem, HeaderUser, AssetUrls } from '@/components/header/DoktersdienstHeader';

/** Root-relative paths (`/…`) so assets resolve from the site origin on every route. */
export const DEFAULT_ASSET_URLS: AssetUrls = {
  logo: '/logo.png',
  ppLogo: '/logo.png',
  requestIcon: '/request.svg',
};

export const DEFAULT_ROUTES: Record<string, string> = {
  spreekuren: '/spreekuren',
  waarneemgroep_gegevens: '/waarneemgroep-gegevens',
  waarneemgroep_wissel: '/waarneemgroep-wissel',
  regio_toevoegen: '/regio-toevoegen',
  waarneemgroep_toevoegen: '/waarneemgroep-toevoegen',
  waarneemgroep_wijzigen: '/waarneemgroep-wijzigen',
  vakantie: '/vakantie',
  deelnemer_toevoegen: '/deelnemer-toevoegen',
  bestaande_toevoegen: '/bestaande-toevoegen',
  lijst_deelnemers: '/lijst-deelnemers',
  rollen_afmelden: '/rollen-afmelden',
  shift_toevoegen: '/shift-toevoegen',
  shift_toevoegen_jsx: '/shift-toevoegen',
  shift_verwijderen: '/shift-verwijderen',
  Activiteit_Soorten: '/activiteit-soorten',
  activiteit_soorten_jsx: '/activiteit-soorten',
  taak_soorten_beheren: '/taak-soorten-beheren',
  taak_soorten_beheren_jsx: '/taak-soorten-beheren',
  location: '/locaties',
  locaties_jsx: '/locaties',
  Expertise_competences: '/expertise-competences',
  absentie_soorten: '/absentie-soorten',
  Gebruikers: '/gebruikers',
  gebruikers_jsx: '/gebruikers',
  mijn_gegevens_deelnemer: '/mijn-gegevens',
  mijn_gegevens_deelnemer_jsx: '/mijn-gegevens',
  logout: '/api/auth/signout',
};

export function headerUserFromSession(user: { name?: string | null; email?: string | null; role?: string } | null): HeaderUser {
  if (!user) {
    return {
      UserName: 'Gast',
      ShortName: '—',
      TypeOfUser: 'user',
    };
  }
  const name = user.name?.trim() || user.email?.trim() || 'Gebruiker';
  const shortName =
    user.name
      ?.split(/\s+/)
      .map((s) => s[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || user.email?.slice(0, 2).toUpperCase() || '?';
  return {
    UserName: name,
    ShortName: shortName,
    TypeOfUser: (user as { role?: string }).role ?? 'user',
  };
}

export const EMPTY_WAARNEMGROEPEN: WaarneemgroepItem[] = [];
