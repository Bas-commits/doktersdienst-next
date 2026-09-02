/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DaypartTimesEditor } from './DaypartTimesEditor';
import type { PraktijkplannerDaypart } from '@/types/praktijkplanner';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/image', () => ({
  default: () => <span data-testid="dagdeelplaatje" />,
}));

const dayparts = [
  { id: 1, naam: 'Ochtend', volgorde: 1 },
  { id: 2, naam: 'Middag', volgorde: 2 },
] as PraktijkplannerDaypart[];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DaypartTimesEditor', () => {
  it('toont de opgeslagen tijden zonder de seconden uit de database', () => {
    render(
      <DaypartTimesEditor
        groupId={77}
        dayparts={dayparts}
        daypartTimes={[{ iddagdeel: 1, begintijd: '08:00:00', eindtijd: '13:00:00' }]}
        onSaved={() => {}}
      />
    );

    expect(screen.getByLabelText('Begintijd Ochtend')).toHaveValue('08:00');
    expect(screen.getByLabelText('Eindtijd Ochtend')).toHaveValue('13:00');
    expect(screen.getByLabelText('Begintijd Middag')).toHaveValue('');
  });

  it('stuurt alleen de dagdelen waar beide tijden staan', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ daypartTimes: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DaypartTimesEditor groupId={77} dayparts={dayparts} daypartTimes={[]} onSaved={() => {}} />
    );

    fireEvent.change(screen.getByLabelText('Begintijd Ochtend'), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText('Eindtijd Ochtend'), { target: { value: '13:00' } });
    // Alleen een begintijd is geen dagdeel: die regel hoort niet mee te gaan.
    fireEvent.change(screen.getByLabelText('Begintijd Middag'), { target: { value: '13:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Opslaan/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      times: Array<{ iddagdeel: number }>;
    };
    expect(body.times).toEqual([{ iddagdeel: 1, begintijd: '08:00', eindtijd: '13:00' }]);
  });

  it('waarschuwt bij een half ingevuld dagdeel', () => {
    render(
      <DaypartTimesEditor groupId={77} dayparts={dayparts} daypartTimes={[]} onSaved={() => {}} />
    );

    expect(screen.queryByText(/wordt niet bewaard/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Begintijd Middag'), { target: { value: '13:00' } });
    expect(screen.getByText(/wordt niet bewaard/)).toBeInTheDocument();
  });

  it('zegt het als een dagdeel over middernacht heen loopt', () => {
    render(
      <DaypartTimesEditor
        groupId={77}
        dayparts={dayparts}
        daypartTimes={[{ iddagdeel: 2, begintijd: '23:00', eindtijd: '07:00' }]}
        onSaved={() => {}}
      />
    );

    expect(screen.getByText('Loopt door tot de volgende dag.')).toBeInTheDocument();
  });
});
