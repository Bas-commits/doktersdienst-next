/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { PlannerAbsenceEditor } from './PlannerAbsenceEditor';
import type { PraktijkplannerPageContext } from './PraktijkplannerPage';

const mocks = vi.hoisted(() => ({
  toastInfo: vi.fn(),
}));

vi.mock('@/components/CalandarGrid/MonthNavigation', () => ({
  MonthNavigation: () => <div>Maandnavigatie</div>,
}));

vi.mock('@/hooks/praktijkplanner/usePlannerHolidays', () => ({
  usePlannerHolidayData: () => ({
    labels: new Map(),
    publicHolidayDates: new Set(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: mocks.toastInfo,
    success: vi.fn(),
  },
}));

const context: PraktijkplannerPageContext = {
  groupId: 3,
  groupName: 'Testgroep',
  reload: vi.fn(),
  data: {
    idwaarneemgroep: 3,
    userId: 7,
    isManager: true,
    isAdmin: false,
    participants: [
      {
        id: 7,
        voornaam: 'Ada',
        voorletterstussenvoegsel: null,
        achternaam: 'Lovelace',
        initialen: 'AL',
        color: '#334155',
        name: null,
      },
      {
        id: 8,
        voornaam: 'Grace',
        voorletterstussenvoegsel: null,
        achternaam: 'Hopper',
        initialen: 'GH',
        color: '#64748b',
        name: null,
      },
    ],
    masterData: {
      dayparts: [
        { id: 1, naam: 'Ochtend', volgorde: 1 },
        { id: 2, naam: 'Middag', volgorde: 2 },
      ],
      expertises: [],
      activities: [],
      specifications: [],
      tasks: [],
      locations: [],
      availabilityTypes: [],
      absenceTypes: [
        {
          id: 5,
          naam: 'Vakantie',
          code: 'VAK',
          kleur: '#0f766e',
          icon: null,
          actief: true,
        },
      ],
      schedulableDayparts: [],
      participantSchedulableDayparts: [],
    },
  },
};

function response(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

describe('PlannerAbsenceEditor doctor mode', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/praktijkplanner/afwezigheden' && init?.method === 'POST') {
        return Promise.resolve(response({ success: true }));
      }
      if (url.startsWith('/api/praktijkplanner/voorkeuren')) {
        return Promise.resolve(response({ toonDag: true, toonNacht: true }));
      }
      return Promise.resolve(response({ slots: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses a full self-only month view with preliminary absence choices', async () => {
    render(<PlannerAbsenceEditor context={context} mode="doctor" />);

    // De maandnavigatie zit in de paginakop en komt daar via een portal terecht, dus buiten
    // PraktijkplannerPage verschijnt hij niet. Wat hier telt is dat dit scherm een
    // maandkalender toont en geen weekrooster.
    expect(screen.getByText('Maandag')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Weeknavigatie' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vakantie?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vakantie' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leegmaken' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: / Ochtend$/ }).length).toBeGreaterThan(7);

    fireEvent.click(screen.getByRole('button', { name: 'Vakantie?' }));
    fireEvent.click(screen.getAllByRole('button', { name: / Ochtend$/ })[0]);

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === '/api/praktijkplanner/afwezigheden' &&
          (init as RequestInit | undefined)?.method === 'POST'
      );
      expect(postCall).toBeDefined();
      expect(JSON.parse((postCall?.[1] as RequestInit).body as string)).toMatchObject({
        idwaarneemgroep: 3,
        slots: [
          {
            iddeelnemer: 7,
            idafwezigheidstype: 5,
            isVoorlopig: true,
          },
        ],
      });
    });
  });

  it('prevents doctors from changing confirmed absences', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/praktijkplanner/afwezigheden' && init?.method === 'POST') {
        return Promise.resolve(response({ success: true }));
      }
      if (url.startsWith('/api/praktijkplanner/voorkeuren')) {
        return Promise.resolve(response({ toonDag: true, toonNacht: true }));
      }
      const start = new URL(url, 'http://localhost').searchParams.get('start');
      return Promise.resolve(
        response({
          slots: [
            {
              id: 10,
              iddeelnemer: 7,
              datum: start,
              iddagdeel: 1,
              idafwezigheidstype: 5,
              isVoorlopig: false,
              version: 1,
              absenceType: {
                id: 5,
                naam: 'Vakantie',
                code: 'VAK',
                kleur: '#0f766e',
                icon: null,
              },
            },
          ],
        })
      );
    });

    render(<PlannerAbsenceEditor context={context} mode="doctor" />);
    fireEvent.click(screen.getByRole('button', { name: 'Leegmaken' }));
    await waitFor(() => expect(screen.getAllByText('Vakantie')).toHaveLength(1));
    fireEvent.click(screen.getAllByRole('button', { name: / Ochtend$/ })[0]);

    expect(mocks.toastInfo).toHaveBeenCalledWith(
      'Deze afwezigheid is bevestigd en kan niet meer worden gewijzigd.',
      expect.any(Object)
    );
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url === '/api/praktijkplanner/afwezigheden' &&
          (init as RequestInit | undefined)?.method === 'POST'
      )
    ).toBe(false);
  });
});

const dienstContext: PraktijkplannerPageContext = {
  ...context,
  data: {
    ...context.data,
    masterData: {
      ...context.data.masterData,
      tasks: [
        {
          id: 50,
          afkorting: 'DNST',
          omschrijving: 'Dienst',
          kleur: '#0ea5e9',
          idexpertise: null,
          nietLocatieGebonden: true,
          inbelbaar: false,
          isDienst: true,
          actief: true,
        },
      ],
    },
  },
};

describe('PlannerAbsenceEditor dienstvoorkeur', () => {
  const fetchMock = vi.fn();

  function stubFetch(slots: unknown[] = [], voorkeuren: unknown[] = []) {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve(response({ success: true }));
      if (url.startsWith('/api/praktijkplanner/dienstvoorkeuren')) {
        return Promise.resolve(response({ voorkeuren }));
      }
      if (url.startsWith('/api/praktijkplanner/voorkeuren')) {
        return Promise.resolve(response({ toonDag: true, toonNacht: true }));
      }
      return Promise.resolve(response({ slots }));
    });
    vi.stubGlobal('fetch', fetchMock);
  }

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('blijft weg bij een groep zonder diensttaken', async () => {
    stubFetch();
    render(<PlannerAbsenceEditor context={context} mode="doctor" />);

    expect(screen.queryByRole('button', { name: 'Dienst graag' })).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        (url as string).startsWith('/api/praktijkplanner/dienstvoorkeuren')
      )
    ).toBe(false);
  });

  it('slaat een dienstvoorkeur op het aangeklikte dagdeel op', async () => {
    stubFetch();
    render(<PlannerAbsenceEditor context={dienstContext} mode="doctor" />);

    fireEvent.click(screen.getByRole('button', { name: 'Dienst graag' }));
    fireEvent.click(screen.getAllByRole('button', { name: / Ochtend$/ })[0]);

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === '/api/praktijkplanner/dienstvoorkeuren' &&
          (init as RequestInit | undefined)?.method === 'POST'
      );
      expect(postCall).toBeDefined();
      expect(JSON.parse((postCall?.[1] as RequestInit).body as string)).toMatchObject({
        idwaarneemgroep: 3,
        voorkeuren: [{ iddeelnemer: 7, iddagdeel: 1, voorkeur: 'graag' }],
      });
    });
  });

  it('waarschuwt bij graag dienst op een dagdeel met afwezigheid en bewaart pas na akkoord', async () => {
    const datum = new Date().toISOString().slice(0, 8) + '15';
    stubFetch([
      {
        id: 10,
        iddeelnemer: 7,
        datum,
        iddagdeel: 1,
        idafwezigheidstype: 5,
        isVoorlopig: true,
        version: 1,
        absenceType: { id: 5, naam: 'Vakantie', code: 'VAK', kleur: '#0f766e', icon: null },
      },
    ]);
    render(<PlannerAbsenceEditor context={dienstContext} mode="doctor" />);

    await waitFor(() => expect(screen.getAllByText('Vakantie?').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Dienst graag' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${datum} Ochtend$`) }));

    await waitFor(() =>
      expect(screen.getByTestId('dienstvoorkeur-conflict-modal')).toBeInTheDocument()
    );
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url === '/api/praktijkplanner/dienstvoorkeuren' &&
          (init as RequestInit | undefined)?.method === 'POST'
      )
    ).toBe(false);

    fireEvent.click(screen.getByTestId('dienstvoorkeur-conflict-bevestig'));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            url === '/api/praktijkplanner/dienstvoorkeuren' &&
            (init as RequestInit | undefined)?.method === 'POST'
        )
      ).toBe(true)
    );
  });
});
