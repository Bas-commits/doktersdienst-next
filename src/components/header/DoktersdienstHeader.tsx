import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { TbSwitch3 } from 'react-icons/tb';
import { authClient } from '@/lib/auth-client';
import { Trash2 } from 'lucide-react';
import { FaRedo } from "react-icons/fa";
import { toast } from 'sonner';

import {
  WaarneemgroepContext,
  type WaarneemgroepContextValue,
} from '@/contexts/WaarneemgroepContext';

const STORAGE_GROUP_ID_KEY = 'groupid';

export interface WaarneemgroepItem {
  ID: number;
  naam: string;
  idgroep?: number | null;
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

  // Overname verzoeken state
  interface OvernameVerzoek {
    iddienstovern: number;
    status?: 'pending' | 'declined' | string | null;
    datum: string;
    datumVan?: string;
    datumTot?: string;
    isPartial?: boolean;
    van: string;
    tot: string;
    week: number;
    waarneemgroep: string;
    vanArts: { initialen: string; naam: string; color: string; akkoord: boolean };
    naarArts: { initialen: string; naam: string; color: string; akkoord: boolean };
  }
  const [verzoeken, setVerzoeken] = useState<OvernameVerzoek[]>([]);
  const [verzoekPopoverOpen, setVerzoekPopoverOpen] = useState(false);
  const [verzoekIndex, setVerzoekIndex] = useState(0);
  const verzoekRef = useRef<HTMLLIElement>(null);

  const fetchVerzoeken = useCallback(() => {
    fetch('/api/overnames/pending', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.verzoeken)) setVerzoeken(data.verzoeken);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchVerzoeken();
    // Re-fetch when an overname is created/accepted/declined/deleted on the overnames page
    const onUpdate = () => fetchVerzoeken();
    window.addEventListener('overname-updated', onUpdate);
    return () => window.removeEventListener('overname-updated', onUpdate);
  }, [fetchVerzoeken]);

  const handleVerzoekRespond = useCallback(
    async (action: 'accept' | 'decline' | 'delete' | 'redo') => {
      const v = verzoeken[verzoekIndex];
      if (!v) return;
      if (action === 'redo') {
        setVerzoekPopoverOpen(false);
        router.push(`/overnames?recreate=${v.iddienstovern}`);
        return;
      }
      const res = await fetch('/api/overnames/respond', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iddienstovern: v.iddienstovern, action }),
      });
      fetchVerzoeken();
      setVerzoekIndex(0);
      window.dispatchEvent(new Event('overname-updated'));
      if (action === 'delete') {
        setVerzoekPopoverOpen(false);
        if (res.ok) toast.success('Overname verwijderd');
        else toast.error('Verwijderen mislukt');
      }
    },
    [verzoeken, verzoekIndex, fetchVerzoeken, router]
  );

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (verzoekRef.current && !verzoekRef.current.contains(e.target as Node)) {
        setVerzoekPopoverOpen(false);
      }
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
            className="inline-block cursor-pointer py-1.5 mr-4 text-[1.09375rem] leading-inherit whitespace-nowrap no-underline hover:no-underline focus:no-underline [&_img]:max-h-[46px]"
            href="#"
            data-testid="header-logo"
          >
            <img src={assetUrls.logo} alt="DoktersDienst" className="ml-[10px]" />
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
              className="w-full h-[50px] cursor-pointer pl-4 pr-10 rounded-[30px] text-l font-semibold appearance-none text-[#333333] bg-white border-0"
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
            <li className="relative" ref={verzoekRef}>
              <button
                type="button"
                className="relative flex items-center py-2 px-3 bg-transparent border-0 cursor-pointer"
                onClick={() => setVerzoekPopoverOpen((o) => !o)}
                aria-label="Overname verzoeken"
                data-testid="header-overname-btn"
              >
                <TbSwitch3 size={30} className="text-[#333]" />
                {verzoeken.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                    {verzoeken.length}
                  </span>
                )}
              </button>
              {verzoekPopoverOpen && verzoeken.length > 0 && (() => {
                const v = verzoeken[verzoekIndex];
                if (!v) return null;
                const vanDatum = v.datumVan ?? v.datum;
                const totDatum = v.datumTot ?? v.datumVan ?? v.datum;
                const overnameTypeLabel = v.isPartial ? 'Gedeeltelijke overname' : 'Volledige overname';
                const isDeclined = v.status === 'declined';
                return (
                  <div
                    className="absolute top-full right-0 z-1000 w-[320px] bg-white border border-gray-300 rounded-lg shadow-lg p-4 mt-1"
                    data-testid="overname-popover"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <button
                        type="button"
                        className="p-1 bg-transparent border-0 cursor-pointer disabled:opacity-30"
                        onClick={() => setVerzoekIndex((i) => Math.max(0, i - 1))}
                        disabled={verzoekIndex === 0}
                        aria-label="Vorige"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-gray-500 font-medium">
                        {verzoekIndex + 1}/{verzoeken.length} verzoeken
                      </span>
                      <button
                        type="button"
                        className="p-1 bg-transparent border-0 cursor-pointer disabled:opacity-30"
                        onClick={() => setVerzoekIndex((i) => Math.min(verzoeken.length - 1, i + 1))}
                        disabled={verzoekIndex === verzoeken.length - 1}
                        aria-label="Volgende"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="bg-gray-200 rounded-md p-5 ">
                    <div className="w-full flex justify-around mb-3">
                      <div className="flex flex-1"></div>
                      <Trash2 className="w-8 h-8 text-red-500 flex flex-1  cursor-pointer " onClick={() => handleVerzoekRespond('delete')} aria-label="Verwijderen" />
                      <div className="flex flex-1 justify-center items-center cursor-pointer " onClick={() => handleVerzoekRespond('redo')} >
                        {isDeclined && (
                          <FaRedo className="w-6 h-6 text-blue-500 " />
                        )}
                      </div>
                    </div>

                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-s font-bold ">{overnameTypeLabel}</p>
                      {isDeclined && (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-800">
                          Afgewezen
                        </span>
                      )}
                    </div>
               
                    <div className="flex text-sm mb-3">
                      
                      <p className="mb-1 ">Van: <br /> Tot:</p>
                      <p className="mb-1 ml-2">{vanDatum} <strong>{v.van}</strong> <br /> {totDatum} <strong>{v.tot}</strong></p>

                    </div>

                    <div className="flex items-center justify-between mb-3 text-sm">
                      <div className="flex items-center gap-2">
                      <p className="text-s font-bold w-[35px]">Van:</p>
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-white text-xs font-bold"
                          style={{ backgroundColor: v.vanArts.color }}
                        >
                          {v.vanArts.initialen}
                        </span>
                        <div>
                          <p className="font-medium leading-tight">{v.vanArts.naam}</p>
                          
                        </div>
                        
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4 text-sm">
                      <div className="flex items-center gap-2">
                      <p className="text-s font-bold w-[35px]">Naar:</p>
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-white text-xs font-bold"
                          style={{ backgroundColor: v.naarArts.color }}
                        >
                          {v.naarArts.initialen}
                        </span>
                        <div>
                          <p className="font-medium leading-tight">{v.naarArts.naam}</p>
                          
                        </div>
                        
                      </div>
                    </div>

                    <div className="flex justify-center gap-4">
                      {isDeclined ? (
                        <button
                          type="button"
                          className="flex cursor-pointer items-center justify-center h-10 px-6 rounded-md border border-gray-300 bg-white text-sm hover:bg-red-300"
                          onClick={() => handleVerzoekRespond('delete')}
                          aria-label="Afgewezen verzoek verwijderen"
                          data-testid="overname-delete"
                        >
                          <Trash2 className="w-5 h-5 text-[#333] mr-1" /> Verwijderen
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="flex cursor-pointer items-center justify-center h-10 px-10 rounded-md border border-gray-300 bg-white hover:bg-green-300"
                            onClick={() => handleVerzoekRespond('accept')}
                            aria-label="Verzoek accepteren"
                            data-testid="overname-accept"
                          >
                            <Check className="w-6 h-6 text-[#333]" />
                          </button>
                          <button
                            type="button"
                            className="flex cursor-pointer items-center justify-center h-10 px-10 rounded-md border border-gray-300 bg-white hover:bg-red-300"
                            onClick={() => handleVerzoekRespond('decline')}
                            aria-label="Verzoek afwijzen"
                            data-testid="overname-decline"
                          >
                            <X className="w-6 h-6 text-[#333]" />
                          </button>
                        </>
                      )}
                    </div>
                    </div>
                  </div>
                );
              })()}
            </li>

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
                    className="block w-full cursor-pointer py-1 px-6 font-normal text-[#222222] no-underline whitespace-nowrap bg-transparent border-0 hover:bg-gray-100 hover:text-[#151515] focus:bg-gray-100"
                    href={routes.mijn_gegevens_deelnemer}
                    id="mijnGegevensLink"
                    data-testid="header-link-mijn-gegevens"
                  >
                    Mijn gegevens
                  </Link>
                  <button
                    type="button"
                    className="block w-full cursor-pointer py-1 px-6 font-normal text-[#222222] no-underline whitespace-nowrap bg-transparent border-0 hover:bg-gray-100 hover:text-[#151515] focus:bg-gray-100"
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
