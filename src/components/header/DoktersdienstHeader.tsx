import { useState, useEffect, useCallback } from 'react';
import { Link, router } from '@inertiajs/react';
import { HeaderSwitchRequests } from './HeaderSwitchRequests';

const STORAGE_GROUP_ID_KEY = 'groupid';

export interface WaarneemgroepItem {
  ID: number;
  naam: string;
}

export interface HeaderUser {
  UserName: string;
  ShortName: string;
  TypeOfUser: string;
}

export interface AssetUrls {
  logo: string;
  ppLogo: string;
  requestIcon: string;
}

export interface DoktersdienstHeaderProps {
  waarneemgroepen: WaarneemgroepItem[];
  headerUser: HeaderUser;
  switchRequestUrl: string;
  invalidateSwitchRequestUrl: string;
  routes: Record<string, string>;
  routeName?: string | null;
  assetUrls: AssetUrls;
}

function getStoredGroupId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const id = localStorage.getItem(STORAGE_GROUP_ID_KEY);
  return id && id.trim() !== '' ? id : null;
}

export function DoktersdienstHeader({
  waarneemgroepen,
  headerUser,
  switchRequestUrl,
  invalidateSwitchRequestUrl,
  routes,
  routeName = null,
  assetUrls,
}: DoktersdienstHeaderProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => getStoredGroupId());

  const syncWindowDoktersdienst = useCallback(
    (activeId: string | null) => {
      if (typeof window === 'undefined') return;
      const win = window as Window & {
        Doktersdienst?: {
          waarneemgroepen: WaarneemgroepItem[];
          typeOfUser: string;
          switchRequestUrl: string;
          activeWaarneemgroepId: string | null;
          getActiveWaarneemgroepId: () => string | null;
          refreshSwitchRequest?: () => void;
        };
      };
      win.Doktersdienst = {
        waarneemgroepen,
        typeOfUser: headerUser.TypeOfUser ?? '',
        switchRequestUrl,
        activeWaarneemgroepId: activeId,
        getActiveWaarneemgroepId: () => (win.Doktersdienst?.activeWaarneemgroepId ?? null) ?? null,
      };
    },
    [waarneemgroepen, headerUser.TypeOfUser, switchRequestUrl]
  );

  useEffect(() => {
    syncWindowDoktersdienst(selectedGroupId);
  }, [selectedGroupId, syncWindowDoktersdienst]);

  useEffect(() => {
    const onRefresh = (): void => {
      const gid = getStoredGroupId();
      setSelectedGroupId(gid);
      if (typeof window !== 'undefined' && (window as { Doktersdienst?: { refreshSwitchRequest?: () => void } }).Doktersdienst?.refreshSwitchRequest) {
        (window as { Doktersdienst: { refreshSwitchRequest: () => void } }).Doktersdienst.refreshSwitchRequest();
      }
    };
    window.addEventListener('doktersdienst-refresh-switch-request', onRefresh);
    return () => window.removeEventListener('doktersdienst-refresh-switch-request', onRefresh);
  }, []);

  const handleGroupChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value?.trim() || null;
      if (value) {
        localStorage.setItem(STORAGE_GROUP_ID_KEY, value);
        setSelectedGroupId(value);
        syncWindowDoktersdienst(value);
        window.dispatchEvent(new Event('doktersdienst-refresh-switch-request'));
        router.reload();
      }
    },
    [syncWindowDoktersdienst]
  );

  const showAdminTools = headerUser.TypeOfUser !== 'Doctor';
  const frontendBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <header className="header-main" data-testid="doktersdienst-header">
      <div className="header-main-inner">
        <nav className="navbar navbar-expand navbar-light navbar-top">
          <a className="navbar-brand" href="#" data-testid="header-logo">
            <img src={assetUrls.logo} alt="Logo" />
          </a>

          <a
            className="navbar-brand_btn"
            href={routes.spreekuren ?? '#'}
            data-testid="header-spreekuren"
            aria-label="Naar spreekuren"
          >
            <img src={assetUrls.ppLogo} alt="Logo" />
            <i className="fa fa-long-arrow-right" aria-hidden="true" />
          </a>

          <select
            name="role"
            className="ml-auto header-info-lable mr-auto Userselect"
            id="groupname"
            value={selectedGroupId ?? ''}
            onChange={handleGroupChange}
            aria-label="Waarneemgroep"
            data-testid="header-group-select"
          >
            {waarneemgroepen.map((wg) => (
              <option key={wg.ID} value={String(wg.ID)}>
                {wg.naam}
              </option>
            ))}
          </select>

          <ul className="navbar-nav align-items-center">
            <li className="nav-item dropdown request_li">
              <HeaderSwitchRequests
                frontendBaseUrl={frontendBaseUrl}
                invalidateSwitchRequestUrl={invalidateSwitchRequestUrl}
              />
            </li>

            {showAdminTools && (
              <li className="nav-item dropdown" data-testid="header-admin-tools">
                <div className="select_admin_tool">
                  <div className="admin_tool_dropdown" aria-hidden="true">
                    Admin Tools
                  </div>
                  <ul className="dropdown_admin_tool">
                    <li>
                      <a href={routes.waarneemgroep_gegevens}>
                        waarneemgroepen
                      </a>
                    </li>
                    <li>
                      <a href={routes.waarneemgroep_wissel} data-inertia-link>
                        Andere waarneemgroep
                      </a>
                    </li>
                    <li>
                      <a href={routes.regio_toevoegen} data-inertia-link>
                        Regio toevoegen
                      </a>
                    </li>
                    <li>
                      <a href={routes.waarneemgroep_toevoegen} data-inertia-link>
                        Waarneemgroep toevoegen
                      </a>
                    </li>
                    <li>
                      <a href={routes.waarneemgroep_wijzigen} data-inertia-link>
                        Waarneemgroep wijzigen
                      </a>
                    </li>
                    <li>
                      <a href={routes.vakantie} data-inertia-link>
                        Vakantie
                      </a>
                    </li>
                    <li>
                      <span>deelnemers</span>
                      <ul>
                        <li className="dropdown_admin_tool_item">
                          <a href={routes.deelnemer_toevoegen}>
                            Deelnemer toevoegen
                          </a>
                        </li>
                        <li className="dropdown_admin_tool_item">
                          <a href={routes.bestaande_toevoegen}>
                            Bestaande toevoegen (van een andere groep)
                          </a>
                        </li>
                        <li className="dropdown_admin_tool_item">
                          <a href={routes.lijst_deelnemers}>
                            Lijst deelnemers
                          </a>
                        </li>
                        <li className="dropdown_admin_tool_item">
                          <a href={routes.rollen_afmelden}>
                            Rollen & Afmelden
                          </a>
                        </li>
                      </ul>
                    </li>
                    <li>
                      <span>shifts</span>
                      <ul>
                        <li className="dropdown_admin_tool_item">
                          <a href={routes.shift_toevoegen_jsx ?? routes.shift_toevoegen}>
                            Shift toevoegen
                          </a>
                        </li>
                        <li className="dropdown_admin_tool_item">
                          <a href={routes.shift_verwijderen}>
                            Shift verwijderen
                          </a>
                        </li>
                      </ul>
                    </li>
                    <li>
                      <a href={routes.activiteit_soorten_jsx ?? routes.Activiteit_Soorten}>
                        activiteiten beheren
                      </a>
                    </li>
                    <li>
                      <a href={routes.taak_soorten_beheren_jsx ?? routes.taak_soorten_beheren}>
                        taken beheren
                      </a>
                    </li>
                    <li>
                      <a href={routes.locaties_jsx ?? routes.location}>
                        locaties beheren
                      </a>
                    </li>
                    <li>
                      <a href={routes.Expertise_competences}>
                        Deskundige beheren
                      </a>
                    </li>
                    <li>
                      <a href={routes.absentie_soorten}>
                        afwezige beheren
                      </a>
                    </li>
                    <li>
                      <a
                        href={routes.gebruikers_jsx ?? routes.Gebruikers}
                        className={routeName === 'gebruikers_jsx' ? 'active' : undefined}
                        data-inertia-link
                      >
                        Gebruikers beheren
                      </a>
                    </li>
                  </ul>
                </div>
              </li>
            )}

            <li className="nav-item dropdown dropdown-menu-right">
              <a
                className="nav-link dropdown-toggle user-profile-drop"
                href="#"
                id="navbarDropdown"
                role="button"
                data-toggle="dropdown"
                aria-haspopup="true"
                aria-expanded="false"
                data-testid="header-user-menu"
                aria-label="Gebruikersmenu"
              >
                <span className="user-name-later" id="user-name-short" data-testid="header-user-short">
                  {headerUser.ShortName}
                </span>
                <span className="user-name-area">
                  <span className="user-name" id="user-name" data-testid="header-user-name">
                    {headerUser.UserName}
                  </span>
                  <span className="admin-text" id="admin-text" data-testid="header-user-type">
                    {headerUser.TypeOfUser}
                  </span>
                </span>
              </a>
              <div className="dropdown-menu dropdown-menu-right" aria-labelledby="navbarDropdown">
                <Link
                  className="dropdown-item"
                  id="mijnGegevensLink"
                  href={routes.mijn_gegevens_deelnemer_jsx ?? routes.mijn_gegevens_deelnemer}
                  data-testid="header-link-mijn-gegevens"
                >
                  Mijn gegevens
                </Link>
                <a
                  className="dropdown-item"
                  href={routes.logout}
                  id="logoutDokter"
                  data-testid="header-link-logout"
                >
                  Log uit
                </a>
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
