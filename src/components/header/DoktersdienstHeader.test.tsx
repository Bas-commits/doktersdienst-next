/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { DoktersdienstHeader } from './DoktersdienstHeader';

const mockReload = vi.fn();
const mockPush = vi.fn().mockResolvedValue(undefined);

vi.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/',
    reload: mockReload,
    push: mockPush,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signOut: vi.fn().mockResolvedValue(undefined),
    useSession: () => ({ data: { user: { id: '999' } }, isPending: false }),
  },
}));

vi.mock('@/contexts/WaarneemgroepContext', async () => {
  const { createContext } = await import('react');
  return { WaarneemgroepContext: createContext(null) };
});

// Mock fetch for API calls (pending overnames + deelnemer role)
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const defaultProps = {
  waarneemgroepen: [
    {
      ID: 1,
      naam: 'Groep A',
      telnringaand: '020-1234567',
      telnronzecentrale: '088-1112233',
    },
    {
      ID: 2,
      naam: 'Groep B',
      telnringaand: '030-7654321',
      telnronzecentrale: '088-4445566',
    },
  ],
  headerUser: {
    UserName: 'Jan de Vries',
    ShortName: 'JD',
    TypeOfUser: 'Admin',
  },
  routes: {
    spreekuren: '/spreekuren',
    mijn_gegevens_deelnemer: '/mijn-gegevens',
    logout: '/logout',
  },
  assetUrls: {
    logo: '/logo.png',
    ppLogo: '/logo.png',
    requestIcon: '/request.svg',
  },
};

describe('DoktersdienstHeader', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (url.includes('/api/deelnemers/role')) {
        return {
          ok: true,
          json: () => Promise.resolve({ idgroep: 5 }),
        } as Response;
      }
      if (url.includes('/api/overnames/pending')) {
        return {
          ok: true,
          json: () => Promise.resolve({ verzoeken: [] }),
        } as Response;
      }
      return {
        ok: true,
        json: () => Promise.resolve({}),
      } as Response;
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => (key === 'groupid' ? '1' : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    });
  });

  it('renders header with logo, group select and user menu', () => {
    render(<DoktersdienstHeader {...defaultProps} />);

    expect(screen.getByTestId('doktersdienst-header')).toBeInTheDocument();
    expect(screen.getByTestId('header-logo')).toBeInTheDocument();
    expect(screen.getByTestId('header-group-select')).toBeInTheDocument();
    expect(screen.getByTestId('header-user-menu')).toBeInTheDocument();
  });

  it('appends telnringaand and telnronzecentrale to each option label', () => {
    render(<DoktersdienstHeader {...defaultProps} />);

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Groep A — 020-1234567 - 088-1112233');
    expect(options[1]).toHaveTextContent('Groep B — 030-7654321 - 088-4445566');
  });

  it('renders group select options from waarneemgroepen', () => {
    render(<DoktersdienstHeader {...defaultProps} />);

    const select = screen.getByTestId('header-group-select');
    expect(select).toHaveValue('1');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Groep A');
    expect(options[1]).toHaveTextContent('Groep B');
  });

  it('renders user short name and type in user menu', () => {
    render(<DoktersdienstHeader {...defaultProps} />);

    expect(screen.getByTestId('header-user-short')).toHaveTextContent('JD');
    expect(screen.getByTestId('header-user-name')).toHaveTextContent('Jan de Vries');
    expect(screen.getByTestId('header-user-type')).toHaveTextContent('Admin');
  });

  it('renders Mijn gegevens link with correct href when user menu is open', () => {
    render(<DoktersdienstHeader {...defaultProps} />);

    fireEvent.click(screen.getByTestId('header-user-menu'));

    expect(screen.getByTestId('header-link-mijn-gegevens')).toHaveAttribute('href', '/mijn-gegevens');
  });

  it('updates localStorage and reloads on group change', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => (key === 'groupid' ? '1' : null)),
      setItem,
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    });

    render(<DoktersdienstHeader {...defaultProps} />);

    const select = screen.getByTestId('header-group-select');
    fireEvent.change(select, { target: { value: '2' } });

    expect(setItem).toHaveBeenCalledWith('groupid', '2');
    expect(mockReload).toHaveBeenCalled();
  });

  it('shows separate start and end dates in overname popover', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (url.includes('/api/deelnemers/role')) {
        return {
          ok: true,
          json: () => Promise.resolve({ idgroep: 5 }),
        } as Response;
      }
      if (url.includes('/api/overnames/pending')) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              verzoeken: [
                {
                  iddienstovern: 10,
                  iddeelnovern: 1,
                  senderId: 2,
                  datum: 'maandag 1 januari',
                  datumVan: 'maandag 1 januari',
                  datumTot: 'dinsdag 2 januari',
                  van: '23:00',
                  tot: '07:00',
                  week: 1,
                  waarneemgroep: 'Groep A',
                  vanArts: { initialen: 'AB', naam: 'Arts Bron', color: '#123456', akkoord: true },
                  naarArts: { initialen: 'CD', naam: 'Arts Doel', color: '#654321', akkoord: false },
                },
              ],
            }),
        } as Response;
      }
      return {
        ok: true,
        json: () => Promise.resolve({}),
      } as Response;
    });

    render(<DoktersdienstHeader {...defaultProps} />);

    fireEvent.click(screen.getByTestId('header-overname-btn'));

    const popover = await screen.findByTestId('overname-popover');
    expect(popover.textContent ?? '').toContain('Van:');
    expect(popover.textContent ?? '').toContain('Tot:');
    expect(popover.textContent ?? '').toContain('maandag 1 januari');
    expect(popover.textContent ?? '').toContain('dinsdag 2 januari');
  });
});
