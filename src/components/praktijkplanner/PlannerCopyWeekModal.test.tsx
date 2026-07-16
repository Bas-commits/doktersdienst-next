/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { PlannerCopyWeekModal } from './PlannerCopyWeekModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/hooks/praktijkplanner/usePlannerHolidays', () => ({
  usePlannerHolidays: () => new Map(),
}));

vi.mock('@/components/praktijkplanner/PlannerDaypartGrid', () => ({
  PlannerDaypartGrid: () => <div data-testid="daypart-grid" />,
}));

const participant = {
  id: 7,
  voornaam: 'Ada',
  achternaam: 'Lovelace',
  initialen: 'AL',
  color: '#334155',
  name: null,
};

describe('PlannerCopyWeekModal', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('disables copy when the target week equals the source week', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ slots: [] }),
      })
    );

    render(
      <PlannerCopyWeekModal
        open
        onClose={vi.fn()}
        groupId={1}
        participant={participant}
        sourceWeekStart="2026-07-13"
        initialTargetWeekStart="2026-07-13"
        dayparts={[{ id: 1, naam: 'Ochtend', volgorde: 1 }]}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('copy-week-confirm')).toBeDisabled();
    });
  });

  it('enables copy when the target week differs from the source week', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ slots: [] }),
      })
    );

    render(
      <PlannerCopyWeekModal
        open
        onClose={vi.fn()}
        groupId={1}
        participant={participant}
        sourceWeekStart="2026-07-13"
        dayparts={[{ id: 1, naam: 'Ochtend', volgorde: 1 }]}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('copy-week-confirm')).not.toBeDisabled();
    });
  });

  it('asks for overwrite confirmation when the target week already has planning', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        slots: [
          {
            id: 1,
            iddeelnemer: 7,
            datum: '2026-07-20',
            iddagdeel: 1,
            activity: { id: 9, naam: 'ALG', afkorting: 'ALG', kleur: '#008000', icon: null },
            specification: null,
            location: null,
            availability: null,
            tasks: [],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PlannerCopyWeekModal
        open
        onClose={vi.fn()}
        groupId={1}
        participant={participant}
        sourceWeekStart="2026-07-13"
        initialTargetWeekStart="2026-07-20"
        dayparts={[{ id: 1, naam: 'Ochtend', volgorde: 1 }]}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('copy-week-confirm')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId('copy-week-confirm'));

    expect(screen.getByTestId('copy-overwrite-modal')).toBeInTheDocument();
    expect(screen.getByText('Bestaande planning overschrijven?')).toBeInTheDocument();

    // Confirm overwrite posts with overwrite: true
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ success: true, id: 99 }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ slots: [] }),
    });

    fireEvent.click(screen.getByTestId('copy-overwrite-confirm'));

    await waitFor(() => {
      const copyCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === '/api/praktijkplanner/activiteiten/herhaling' &&
          typeof init === 'object' &&
          init != null &&
          'body' in init
      );
      expect(copyCall).toBeTruthy();
      const body = JSON.parse(String((copyCall?.[1] as RequestInit).body));
      expect(body.overwrite).toBe(true);
      expect(body.action).toBe('copyWeek');
    });
  });
});
