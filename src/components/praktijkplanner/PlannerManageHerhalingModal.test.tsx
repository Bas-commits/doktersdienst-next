/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { PlannerManageHerhalingModal } from './PlannerManageHerhalingModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('PlannerManageHerhalingModal', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows an empty state when the participant has no series', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ series: [] }),
      })
    );

    render(
      <PlannerManageHerhalingModal
        open
        onClose={vi.fn()}
        groupId={1}
        participantId={7}
        participantName="Ada Lovelace"
        defaultVanafWeekStart="2026-07-13"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('manage-herhaling-empty')).toBeInTheDocument();
    });
    expect(screen.getByText(/Herhalingen — Ada Lovelace/)).toBeInTheDocument();
  });

  it('names the repeated week and promises to keep it when deleting planning', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          series: [
            {
              id: 9,
              iddeelnemer: 7,
              startdatum: '2026-08-17',
              einddatum: '2026-09-21',
              frequentieWeken: 1,
              bronstartdatum: '2026-08-10',
            },
          ],
        }),
      })
    );

    render(
      <PlannerManageHerhalingModal
        open
        onClose={vi.fn()}
        groupId={1}
        participantId={7}
        participantName="Ada Lovelace"
        defaultVanafWeekStart="2026-08-17"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('manage-herhaling-bron-9')).toHaveTextContent(
        'Herhaling van week 10 – 16 aug 2026'
      );
    });

    fireEvent.click(within(screen.getByTestId('manage-herhaling-item-9')).getByText('Verwijderen'));
    expect(screen.getByTestId('manage-herhaling-bron-blijft')).toHaveTextContent(
      '10 – 16 aug 2026, blijft staan'
    );
  });

  it('leaves the week out for a series recorded before the source week was stored', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          series: [
            {
              id: 9,
              iddeelnemer: 7,
              startdatum: '2026-08-17',
              einddatum: '2026-09-21',
              frequentieWeken: 1,
              bronstartdatum: null,
            },
          ],
        }),
      })
    );

    render(
      <PlannerManageHerhalingModal
        open
        onClose={vi.fn()}
        groupId={1}
        participantId={7}
        participantName="Ada Lovelace"
        defaultVanafWeekStart="2026-08-17"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('manage-herhaling-bron-9')).toHaveTextContent('Herhaling');
    });
    expect(screen.getByTestId('manage-herhaling-bron-9')).not.toHaveTextContent('van week');
  });

  it('saves edits with action edit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          series: [
            {
              id: 9,
              iddeelnemer: 7,
              startdatum: '2026-07-20',
              einddatum: '2026-08-31',
              frequentieWeken: 1,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          series: [
            {
              id: 9,
              iddeelnemer: 7,
              startdatum: '2026-07-20',
              einddatum: '2026-09-14',
              frequentieWeken: 2,
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PlannerManageHerhalingModal
        open
        onClose={vi.fn()}
        groupId={1}
        participantId={7}
        participantName="Ada Lovelace"
        defaultVanafWeekStart="2026-07-13"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('manage-herhaling-item-9')).toBeInTheDocument();
    });

    fireEvent.click(within(screen.getByTestId('manage-herhaling-item-9')).getByText('Bewerken'));
    fireEvent.change(screen.getByTestId('manage-herhaling-edit-end'), {
      target: { value: '2026-09-14' },
    });
    fireEvent.change(screen.getByTestId('manage-herhaling-edit-frequency'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByTestId('manage-herhaling-edit-save'));

    await waitFor(() => {
      const editCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === '/api/praktijkplanner/activiteiten/herhaling' &&
          typeof init === 'object' &&
          init != null &&
          'body' in init &&
          String((init as RequestInit).body).includes('"action":"edit"')
      );
      expect(editCall).toBeTruthy();
      const body = JSON.parse(String((editCall?.[1] as RequestInit).body));
      expect(body).toMatchObject({
        action: 'edit',
        idherhaling: 9,
        einddatum: '2026-09-14',
        frequentieWeken: 2,
      });
    });
  });

  it('deletes from a week with mode and vanaf', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          series: [
            {
              id: 9,
              iddeelnemer: 7,
              startdatum: '2026-07-20',
              einddatum: '2026-08-31',
              frequentieWeken: 1,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ series: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PlannerManageHerhalingModal
        open
        onClose={vi.fn()}
        groupId={1}
        participantId={7}
        participantName="Ada Lovelace"
        defaultVanafWeekStart="2026-07-13"
        onChanged={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('manage-herhaling-item-9')).toBeInTheDocument();
    });

    fireEvent.click(within(screen.getByTestId('manage-herhaling-item-9')).getByText('Verwijderen'));
    expect(screen.getByTestId('manage-herhaling-delete-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Vanaf deze week'));
    fireEvent.change(screen.getByTestId('manage-herhaling-vanaf'), {
      target: { value: '2026-07-15' },
    });
    fireEvent.click(screen.getByLabelText('Ook planning verwijderen'));
    fireEvent.click(screen.getByTestId('manage-herhaling-delete-confirm'));

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === '/api/praktijkplanner/activiteiten/herhaling' &&
          typeof init === 'object' &&
          init != null &&
          'body' in init &&
          String((init as RequestInit).body).includes('"action":"delete"')
      );
      expect(deleteCall).toBeTruthy();
      const body = JSON.parse(String((deleteCall?.[1] as RequestInit).body));
      expect(body).toMatchObject({
        action: 'delete',
        idherhaling: 9,
        mode: 'deletePlanning',
        vanaf: '2026-07-13', // normalized to ISO week Monday
      });
    });
  });
});
