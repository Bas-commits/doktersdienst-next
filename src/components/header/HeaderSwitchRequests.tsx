import { useState, useEffect, useCallback } from 'react';
import { TbSwitch3 } from "react-icons/tb";

const STORAGE_GROUP_ID_KEY = 'groupid';

async function postJson<T>(url: string, body: object): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (typeof document !== 'undefined') {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (csrf) headers['X-CSRF-TOKEN'] = csrf;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export interface SwitchRequestItem {
  OldDoctor: Array<{
    DoctorID: number;
    Name: string;
    Color: string;
    ShortName: string;
    LongName: string;
    diensten_id: number;
  }>;
  NewDoctor: Array<{
    DoctorID: number;
    Name: string;
    Color: string;
    ShortName: string;
    LongName: string;
    van: string;
    naar: string;
    year: string;
    months: string;
    diensten_id: number;
    delete_request?: boolean;
  }>;
}

export interface SwitchRequestResponse {
  success: boolean;
  data: SwitchRequestItem[];
  count: number;
}

export interface HeaderSwitchRequestsProps {
  /** Frontend base URL (e.g. window.location.origin). */
  frontendBaseUrl: string;
  /** URL to invalidate cache after confirm/decline/delete. */
  invalidateSwitchRequestUrl: string;
}

function getStoredGroupId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const id = localStorage.getItem(STORAGE_GROUP_ID_KEY);
  return id && id.trim() !== '' ? id : null;
}

/** Format "dd-mm-yyyy HH:MM" to "11 Oct" (legacy formatDate). */
function formatRequestDate(dateString: string): string {
  const part = dateString.split(' ')[0];
  if (!part) return dateString;
  const [d, m, y] = part.split('-').map(Number);
  if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return dateString;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Extract time from "dd-mm-yyyy HH:MM" (legacy extractTime). */
function extractRequestTime(dateTimeString: string): string {
  const part = dateTimeString.split(' ')[1];
  return part ?? '';
}

export function HeaderSwitchRequests({
  frontendBaseUrl,
  invalidateSwitchRequestUrl,
}: HeaderSwitchRequestsProps) {
  const [groupID, setGroupID] = useState<string | null>(() => getStoredGroupId());
  const [list, setList] = useState<SwitchRequestItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  /** Current slide index when showing one request at a time (0-based). */
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const fetchList = useCallback(async () => {
    const gid = getStoredGroupId();
    setGroupID(gid);
    if (!gid) {
      setList([]);
      setCount(0);
      setLoading(false);
      return;
    }
    try {
      const data = await postJson<SwitchRequestResponse>(
        `${frontendBaseUrl}/DoktersDienst/switch-request`,
        { groupID: gid }
      );
      if (data?.success) {
        setList(data.data ?? []);
        setCount(data.count ?? 0);
      }
    } catch {
      setList([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [frontendBaseUrl]);

  useEffect(() => {
    fetchList();
    const onStorage = (): void => {
      setGroupID(getStoredGroupId());
      fetchList();
    };
    const onRefresh = (): void => {
      fetchList();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('doktersdienst-refresh-switch-request', onRefresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('doktersdienst-refresh-switch-request', onRefresh);
    };
  }, [fetchList]);

  // Reset to first slide when opening dropdown
  useEffect(() => {
    if (dropdownOpen) setCurrentSlideIndex(0);
  }, [dropdownOpen]);

  // Clamp slide index when list length changes (e.g. after delete)
  useEffect(() => {
    if (list.length > 0) {
      setCurrentSlideIndex((prev) => Math.min(prev, list.length - 1));
    }
  }, [list.length]);

  // Arrow key navigation when dropdown is open
  useEffect(() => {
    if (!dropdownOpen || list.length <= 1) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.min(list.length - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dropdownOpen, list.length]);

  const invalidateAndRefetch = useCallback(async () => {
    const gid = getStoredGroupId();
    if (gid) {
      try {
        await postJson(invalidateSwitchRequestUrl, { groupID: gid });
      } catch {
        /* ignore */
      }
    }
    await fetchList();
  }, [invalidateSwitchRequestUrl, fetchList]);

  const handleSwitchChange = useCallback(
    async (dienstenId: number) => {
      const gid = getStoredGroupId();
      if (!gid) return;
      setActionLoading(dienstenId);
      try {
        await postJson(`${frontendBaseUrl}/DoktersDienst/switch-change`, {
          diensten_id: dienstenId,
          groupID: gid,
        });
        await invalidateAndRefetch();
      } finally {
        setActionLoading(null);
      }
    },
    [frontendBaseUrl, invalidateAndRefetch]
  );

  const handleSwitchDelete = useCallback(
    async (dienstenId: number) => {
      setActionLoading(dienstenId);
      try {
        await postJson(`${frontendBaseUrl}/DoktersDienst/switch-delete`, {
          diensten_id: dienstenId,
        });
        await invalidateAndRefetch();
      } finally {
        setActionLoading(null);
      }
    },
    [frontendBaseUrl, invalidateAndRefetch]
  );

  const handleSwitchDeleteAll = useCallback(
    async (dienstenId: number) => {
      setActionLoading(dienstenId);
      try {
        await postJson(`${frontendBaseUrl}/DoktersDienst/switch-delete-all`, {
          diensten_id: dienstenId,
        });
        await invalidateAndRefetch();
      } finally {
        setActionLoading(null);
      }
    },
    [frontendBaseUrl, invalidateAndRefetch]
  );

  if (loading && count === 0) {
    return (
      <div className="relative mr-5 block py-2 px-4" data-testid="header-switch-requests">
        <span
          className="absolute right-1 top-0.5 h-[15px] w-[15px] flex rounded-full text-[10px] items-center justify-center text-white bg-gradient-to-r from-[#FFA7AC] to-[#EC554B]"
          aria-label="Aantal verzoeken"
        >
          0
        </span>
        <TbSwitch3 className="h-[30px] w-[30px]" aria-hidden />
      </div>
    );
  }

  return (
    <div className="relative" data-testid="header-switch-requests">
      <button
        type="button"
        className="relative mr-5 block py-2 px-4 text-[#23303F] bg-transparent border-0 cursor-pointer text-left no-underline"
        onClick={() => setDropdownOpen((o) => !o)}
        aria-expanded={dropdownOpen}
        aria-haspopup="true"
        aria-label="Overname verzoeken"
      >
        <span
          className="absolute right-1 top-0.5 h-[15px] w-[15px] flex rounded-full text-[10px] items-center justify-center text-white bg-gradient-to-r from-[#FFA7AC] to-[#EC554B]"
          aria-label="Aantal verzoeken"
        >
          {count}
        </span>
        <TbSwitch3 className="h-[30px] w-[30px]" aria-hidden />
      </button>
      {dropdownOpen && (
        <>
          <div
            role="presentation"
            className="fixed inset-0 z-999"
            onClick={() => setDropdownOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-full z-1000 block"
            role="menu"
            aria-label="Verzoeken lijst"
          >
            <div className="absolute right-0 w-[270px] border border-[#dcdcdc] p-4 list-none rounded-md bg-[#f9f9f9]">
              {list.length === 0 ? (
                <div className="bg-white border border-[#dcdcdc] rounded-md p-4 mb-0">
                  <p className="mb-0 text-gray-500">Geen verzoeken</p>
                </div>
              ) : (() => {
                  const item = list[currentSlideIndex];
                  if (!item) return null;
                  const van = item.NewDoctor[0];
                  const tot = item.OldDoctor[0];
                  if (!van || !tot) return null;
                  const dienstenId = van.diensten_id;
                  const idx = currentSlideIndex;
                  const isDeclined = van.delete_request === true;
                  const busy = actionLoading === dienstenId;
                  const startTime = extractRequestTime(van.van);
                  const endTime = extractRequestTime(van.naar);
                  const formattedDate = formatRequestDate(van.van);
                  const canGoPrev = idx > 0;
                  const canGoNext = idx < list.length - 1;
                  return (
                    <div
                      key={`${dienstenId}-${idx}`}
                      data-testid="header-switch-request-item"
                    >
                      <div className="flex items-center justify-around mb-2.5">
                        <button
                          type="button"
                          className="border-0 bg-transparent p-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => setCurrentSlideIndex((i) => Math.max(0, i - 1))}
                          disabled={!canGoPrev}
                          aria-label="Vorige verzoek"
                        >
                          <img src="/assets/images/icons/arrow-left.svg" alt="" aria-hidden="true" />
                        </button>
                        <p className="mb-0 text-base">
                          {idx + 1}/{count} verzoeken
                        </p>
                        <button
                          type="button"
                          className="border-0 bg-transparent p-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => setCurrentSlideIndex((i) => Math.min(list.length - 1, i + 1))}
                          disabled={!canGoNext}
                          aria-label="Volgende verzoek"
                        >
                          <img src="/assets/images/icons/arrow-right.svg" alt="" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="bg-white border border-[#dcdcdc] rounded-md p-4">
                        <p className="flex justify-between mb-0">
                          {formattedDate}
                          <a
                            href="#"
                            className="inline-block"
                            onClick={(e) => {
                              e.preventDefault();
                              if (!busy) handleSwitchDeleteAll(dienstenId);
                            }}
                            aria-label="Verwijderen"
                          >
                            <img
                              className="w-4 h-4 inline-block"
                              src="/assets/images/icons/trash-icon.png"
                              alt=""
                              aria-hidden="true"
                            />
                          </a>
                          <a href="#" onClick={(e) => e.preventDefault()} aria-hidden="true" className="text-[21px]">
                            <i className="fa fa-repeat" aria-hidden="true" />
                          </a>
                        </p>
                        {isDeclined ? (
                          <p className="mb-1 text-sm">
                            {startTime} - {endTime} (geheel)
                          </p>
                        ) : (
                          <>
                            <p className="mb-0 font-semibold text-[13px] leading-[18px] text-[#a0a0a0] tracking-wide" id="request_p_van">
                              van vr.{van.van}
                            </p>
                            <p className="mb-0 font-semibold text-[13px] leading-[18px] text-[#a0a0a0] tracking-wide" id="request_p_tot">
                              tot vr.{van.naar}
                            </p>
                          </>
                        )}
                        <div className="flex items-center mt-2.5 justify-around">
                          <p className="mb-0 min-w-[35px] text-right font-bold">van</p>
                          <img
                            className="w-[15px] mx-2.5"
                            src="/assets/images/minus-circle.png"
                            alt=""
                            aria-hidden="true"
                          />
                          <div
                            className="text-white min-w-[56px] font-semibold rounded-md h-6 flex justify-center items-center"
                            style={{ backgroundColor: tot.Color || '#c686fd' }}
                          >
                            {tot.ShortName}
                          </div>
                          <div className="w-[70px] ml-1.5 text-xs leading-[13px] text-[#a0a0a0] tracking-wide">{tot.LongName}</div>
                        </div>
                        <div className="flex items-center mt-2.5 justify-around">
                          <p className="mb-0 min-w-[35px] text-right font-bold">naar</p>
                          <img
                            className="w-[15px] mx-2.5"
                            src="/assets/images/check.png"
                            alt=""
                            aria-hidden="true"
                          />
                          <div
                            className="text-white min-w-[56px] font-semibold rounded-md h-6 flex justify-center items-center"
                            style={{ backgroundColor: van.Color || '#c686fd' }}
                          >
                            {van.ShortName}
                          </div>
                          <div className="w-[70px] ml-1.5 text-xs leading-[13px] text-[#a0a0a0] tracking-wide">{van.LongName}</div>
                        </div>
                        <div className="flex items-center">
                          {!isDeclined ? (
                            <>
                              <a
                                href="#"
                                className="border border-[#dcdcdc] bg-[#f5f5f5] w-full flex items-center justify-center h-10 mt-5 mx-1.5 rounded-sm no-underline text-black [&:hover]:bg-gray-200"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (!busy) handleSwitchChange(dienstenId);
                                }}
                                aria-label="Akkoord"
                                data-testid="header-switch-confirm"
                              >
                                <i className="fa fa-check" aria-hidden="true" />
                              </a>
                              <a
                                href="#"
                                className="border border-[#dcdcdc] bg-[#f5f5f5] w-full flex items-center justify-center h-10 mt-5 mx-1.5 rounded-sm no-underline text-black [&:hover]:bg-gray-200"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (!busy) handleSwitchDelete(dienstenId);
                                }}
                                aria-label="Afwijzen"
                                data-testid="header-switch-decline"
                              >
                                <i className="fa fa-times" aria-hidden="true" />
                              </a>
                            </>
                          ) : (
                            <>
                              <a
                                href="#"
                                className="border border-[#dcdcdc] bg-[#f5f5f5] w-full flex items-center justify-center h-10 mt-5 mx-1.5 rounded-sm no-underline text-red-600 [&:hover]:bg-gray-200"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (!busy) handleSwitchDeleteAll(dienstenId);
                                }}
                                aria-label="Verwijderen"
                                data-testid="header-switch-delete"
                              >
                                <i className="fa fa-times" aria-hidden="true" />
                              </a>
                              <a href="#" onClick={(e) => e.preventDefault()} aria-hidden="true" className="flex items-center justify-center h-10 mt-5 mx-1.5 text-[35px] text-[#a5a5a5]">
                                <i className="fa fa-question-circle" aria-hidden="true" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
