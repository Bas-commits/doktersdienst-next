import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronDown } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import {
  WaarneemgroepContext,
  type WaarneemgroepContextValue,
} from '@/contexts/WaarneemgroepContext';

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
  waarneemgroepen: propsWaarneemgroepen,
  headerUser,
  routes,
  routeName = null,
  assetUrls,
}: DoktersdienstHeaderProps) {
  const router = useRouter();
  const ctx = useContext(WaarneemgroepContext) as WaarneemgroepContextValue | null;
  const [internalGroupId, setInternalGroupId] = useState<string | null>(() => getStoredGroupId());

  const waarneemgroepen: WaarneemgroepItem[] = ctx ? ctx.waarneemgroepen : propsWaarneemgroepen;
  const selectedGroupId = ctx ? ctx.activeWaarneemgroepId : internalGroupId;
  const setSelectedGroupId = ctx ? ctx.setActiveWaarneemgroepId : setInternalGroupId;

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const syncWindowDoktersdienst = useCallback(
    (activeId: string | null) => {
      if (typeof window === 'undefined') return;
      const win = window as Window & {
        Doktersdienst?: {
          waarneemgroepen: WaarneemgroepItem[];
          typeOfUser: string;
          activeWaarneemgroepId: string | null;
          getActiveWaarneemgroepId: () => string | null;
        };
      };
      win.Doktersdienst = {
        waarneemgroepen,
        typeOfUser: headerUser.TypeOfUser ?? '',
        activeWaarneemgroepId: activeId,
        getActiveWaarneemgroepId: () => (win.Doktersdienst?.activeWaarneemgroepId ?? null) ?? null,
      };
    },
    [waarneemgroepen, headerUser.TypeOfUser]
  );

  useEffect(() => {
    syncWindowDoktersdienst(selectedGroupId);
  }, [selectedGroupId, syncWindowDoktersdienst]);

  const handleGroupChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value?.trim() || null;
      if (value) {
        if (!ctx) {
          localStorage.setItem(STORAGE_GROUP_ID_KEY, value);
          syncWindowDoktersdienst(value);
          router.reload();
        }
        setSelectedGroupId(value);
      }
    },
    [ctx, setSelectedGroupId, syncWindowDoktersdienst, router]
  );

  const showAdminTools = headerUser.TypeOfUser !== 'Doctor';
  const handleLogout = useCallback(async () => {
    try {
      await authClient.signOut();
    } finally {
      await router.push('/login');
    }
  }, [router]);

  return (
    <header className="relative" data-testid="doktersdienst-header">
      <div className="sticky top-0 left-0 right-0 z-3 min-w-[1024px] bg-white border-b border-[rgba(151,151,151,0.5)]">
        <nav className="flex flex-nowrap items-center justify-start">
          <a
            className="inline-block py-1.5 mr-4 text-[1.09375rem] leading-inherit whitespace-nowrap no-underline hover:no-underline focus:no-underline [&_img]:max-h-[46px]"
            href="#"
            data-testid="header-logo"
          >
            <img src={assetUrls.logo} alt="Logo" className="ml-[60px]" />
          </a>

          {false && (
            <a
              className="flex items-center bg-[#f0f0f0] border border-[#a5a5a5] rounded-md ml-5 text-xl text-[#a5a5a5] py-2 px-5 no-underline [&_img]:w-[110px] [&_img]:mr-4"
              href={routes.spreekuren ?? '#'}
              data-testid="header-spreekuren"
              aria-label="Naar spreekuren"
            >
              <img src={assetUrls.ppLogo} alt="Logo" />
              <i className="fa fa-long-arrow-right" aria-hidden="true" />
            </a>
          )}

          <div
            className="relative ml-auto mr-auto w-[30%]"
            style={router.pathname === '/mijn-gegevens' ? { visibility: 'hidden' } : undefined}
            aria-hidden={router.pathname === '/mijn-gegevens'}
          >
            <select
              name="role"
              className="w-full h-[50px] pl-4 pr-10 rounded-[30px] text-l font-semibold appearance-none text-[#333333] bg-white border-0"
              id="groupname"
              value={selectedGroupId ?? ''}
              onChange={handleGroupChange}
              aria-label="Waarneemgroep"
              data-testid="header-group-select"
              tabIndex={router.pathname === '/mijn-gegevens' ? -1 : undefined}
            >
              {waarneemgroepen.map((wg: WaarneemgroepItem) => (
                <option key={wg.ID} value={String(wg.ID)}>
                  {wg.naam}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 text-[#333333] pointer-events-none"
              aria-hidden
            />
          </div>

          <ul className="flex flex-row items-center list-none p-0 mb-0">
            {showAdminTools && (
              <li className="relative font-normal mr-6 group" data-testid="header-admin-tools">
                <div className="cursor-pointer">
                  <span className="text-[17px] text-black cursor-pointer inline-flex items-center gap-2" aria-hidden="true">
                    Admin Tools <span aria-hidden="true"><ChevronDown className="w-4 h-4" /></span>
                  </span>
                  <ul className="hidden group-hover:block absolute w-[400px] right-0 bg-white border border-[#dcdcdc] py-2.5 px-5 list-none rounded-md z-1000 shadow-lg">
                    <li>
                      <a href={routes.waarneemgroep_gegevens} className="text-black text-base my-2 block">
                        waarneemgroepen
                      </a>
                    </li>
                    
                    <li>
                      <a href={routes.regio_toevoegen} data-inertia-link className="text-black text-base my-2 block">
                        Regio toevoegen
                      </a>
                    </li>
                    <li>
                      <Link href="/waarneemgroep-toevoegen" className="text-black text-base my-2 block">
                        Waarneemgroep toevoegen
                      </Link>
                    </li>
                    <li>
                      <a href={routes.waarneemgroep_wijzigen} data-inertia-link className="text-black text-base my-2 block">
                        Waarneemgroep wijzigen
                      </a>
                    </li>
                    <li>
                      <Link href="/vakanties" className="text-black text-base my-2 block">
                        Vakanties
                      </Link>
                    </li>
                    <li>
                      <span className="text-black text-base my-2 block">deelnemers</span>
                      <ul className="list-none pl-0">
                        <li>
                          <a href={routes.deelnemer_toevoegen} className="text-[13px] my-1 block">
                            Deelnemer toevoegen
                          </a>
                        </li>
                        <li>
                          <a href={routes.bestaande_toevoegen} className="text-[13px] my-1 block">
                            Bestaande toevoegen (van een andere groep)
                          </a>
                        </li>
                        <li>
                          <a href={routes.lijst_deelnemers} className="text-[13px] my-1 block">
                            Lijst deelnemers
                          </a>
                        </li>
                        <li>
                          <a href={routes.rollen_afmelden} className="text-[13px] my-1 block">
                            Rollen & Afmelden
                          </a>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </div>
              </li>
            )}

            <li className="relative" ref={userMenuRef}>
              <button
                type="button"
                className="flex items-center py-2 px-4 text-[#23303F] bg-transparent border-0 cursor-pointer text-left w-full no-underline hover:no-underline focus:no-underline"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={userMenuOpen}
                data-testid="header-user-menu"
                aria-label="Gebruikersmenu"
              >
                <span
                  className="text-[#2449bf] border-[3px] border-[#2449bf] rounded min-h-10 min-w-10 text-[17px] text-center flex items-center justify-center leading-9 mr-1.5 px-1.5 shrink-0"
                  id="user-name-short"
                  data-testid="header-user-short"
                >
                  {headerUser.ShortName}
                </span>
                <span className="block">
                  <span className="block text-[17px] leading-5" id="user-name" data-testid="header-user-name">
                    {headerUser.UserName}
                  </span>
                  <span className="block text-[#b0b0b0] text-[15px] leading-[17px]" id="admin-text" data-testid="header-user-type">
                    {headerUser.TypeOfUser}
                  </span>
                </span>
              </button>
              {userMenuOpen && (
                <div
                  className="absolute top-full right-0 left-auto z-1000 min-w-40 py-2 mt-0.5 text-sm text-[#23303F] list-none bg-white border border-black/15 rounded-[0.313rem] shadow-md"
                  role="menu"
                  aria-labelledby="navbarDropdown"
                >
                  <Link
                    className="block w-full py-1 px-6 font-normal text-[#222222] no-underline whitespace-nowrap bg-transparent border-0 hover:bg-gray-100 hover:text-[#151515] focus:bg-gray-100"
                    href={routes.mijn_gegevens_deelnemer}
                    id="mijnGegevensLink"
                    data-testid="header-link-mijn-gegevens"
                  >
                    Mijn gegevens
                  </Link>
                  <button
                    type="button"
                    className="block w-full py-1 px-6 font-normal text-[#222222] no-underline whitespace-nowrap bg-transparent border-0 hover:bg-gray-100 hover:text-[#151515] focus:bg-gray-100"
                    id="logoutDokter"
                    data-testid="header-link-logout"
                    onClick={handleLogout}
                  >
                    Log uit
                  </button>
                </div>
              )}
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
