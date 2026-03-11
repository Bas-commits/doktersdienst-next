import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DoktersdienstHeader } from './DoktersdienstHeader';

vi.mock('./HeaderSwitchRequests', () => ({
  HeaderSwitchRequests: () => <div data-testid="header-switch-requests-mock">Switch requests</div>,
}));

vi.mock('@inertiajs/react', () => ({
  router: { reload: vi.fn() },
  Link: ({ href, children, ...props }: { href: string; children?: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const defaultProps = {
  waarneemgroepen: [
    { ID: 1, naam: 'Groep A' },
    { ID: 2, naam: 'Groep B' },
  ],
  headerUser: {
    UserName: 'Jan de Vries',
    ShortName: 'JD',
    TypeOfUser: 'Admin',
  },
  switchRequestUrl: 'https://app.example.com/DoktersDienst/switch-request',
  invalidateSwitchRequestUrl: 'https://app.example.com/DoktersDienst/invalidate-switch-request',
  routes: {
    spreekuren: '/spreekuren',
    mijn_gegevens_deelnemer: '/mijn-gegevens',
    mijn_gegevens_deelnemer_jsx: '/DoktersDienst/mijn_gegevens_deelnemer_jsx',
    logout: '/logout',
  },
  assetUrls: {
    logo: '/assets/logo.png',
    ppLogo: '/assets/pp-logo.png',
    requestIcon: '/assets/request.svg',
  },
};

describe('DoktersdienstHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByTestId('header-spreekuren')).toHaveAttribute('href', '/spreekuren');
    expect(screen.getByTestId('header-group-select')).toBeInTheDocument();
    expect(screen.getByTestId('header-user-menu')).toBeInTheDocument();
  });

  it('renders group select options from waarneemgroepen', () => {
    render(<DoktersdienstHeader {...defaultProps} />);

    const select = screen.getByLabelText('Waarneemgroep');
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

  it('renders Mijn gegevens and Log uit links with correct hrefs', () => {
    render(<DoktersdienstHeader {...defaultProps} />);

    fireEvent.click(screen.getByTestId('header-user-menu'));

    expect(screen.getByTestId('header-link-mijn-gegevens')).toHaveAttribute('href', '/DoktersDienst/mijn_gegevens_deelnemer_jsx');
    expect(screen.getByTestId('header-link-logout')).toHaveAttribute('href', '/logout');
  });

  it('shows Admin Tools when TypeOfUser is not Doctor', () => {
    render(<DoktersdienstHeader {...defaultProps} />);

    expect(screen.getByTestId('header-admin-tools')).toBeInTheDocument();
  });

  it('hides Admin Tools when TypeOfUser is Doctor', () => {
    render(
      <DoktersdienstHeader
        {...defaultProps}
        headerUser={{ ...defaultProps.headerUser, TypeOfUser: 'Doctor' }}
      />
    );

    expect(screen.queryByTestId('header-admin-tools')).not.toBeInTheDocument();
  });

  it('updates localStorage and reloads on group change', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => (key === 'groupid' ? '1' : null)),
      setItem,
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    });

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(<DoktersdienstHeader {...defaultProps} />);

    const select = screen.getByLabelText('Waarneemgroep');
    fireEvent.change(select, { target: { value: '2' } });

    expect(setItem).toHaveBeenCalledWith('groupid', '2');
    expect(dispatchEventSpy).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    dispatchEventSpy.mockRestore();
  });
});
