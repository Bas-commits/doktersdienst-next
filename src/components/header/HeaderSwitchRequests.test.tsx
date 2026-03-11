import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { HeaderSwitchRequests } from './HeaderSwitchRequests';

const mockFetch = vi.fn();

const frontendBaseUrl = 'https://app.example.com';
const invalidateSwitchRequestUrl = 'https://app.example.com/DoktersDienst/invalidate-switch-request';

const makeSwitchItem = (overrides: Partial<{ delete_request: boolean; diensten_id: number }> = {}) => ({
  OldDoctor: [{ DoctorID: 1, Name: 'Jan', Color: '#ccc', ShortName: 'JD', LongName: 'Jan De Vries', diensten_id: 100 }],
  NewDoctor: [
    {
      DoctorID: 2,
      Name: 'Piet',
      Color: '#f00',
      ShortName: 'PP',
      LongName: 'Piet Pietersen',
      van: '10-06-2025 08:00',
      naar: '10-06-2025 20:00',
      year: '2025',
      months: '6',
      diensten_id: overrides.diensten_id ?? 101,
      delete_request: overrides.delete_request ?? false,
    },
  ],
});

describe('HeaderSwitchRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => (key === 'groupid' ? '42' : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: [makeSwitchItem()],
          count: 1,
        }),
    });
  });

  it('fetches switch-request list from frontend endpoint and shows count in badge', async () => {
    render(
      <HeaderSwitchRequests
        frontendBaseUrl={frontendBaseUrl}
        invalidateSwitchRequestUrl={invalidateSwitchRequestUrl}
      />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `${frontendBaseUrl}/DoktersDienst/switch-request`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ groupID: '42' }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Aantal verzoeken')).toHaveTextContent('1');
    });
  });

  it('shows request items in dropdown when opened', async () => {
    render(
      <HeaderSwitchRequests
        frontendBaseUrl={frontendBaseUrl}
        invalidateSwitchRequestUrl={invalidateSwitchRequestUrl}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Aantal verzoeken')).toHaveTextContent('1');
    });

    const button = screen.getByRole('button', { name: /overname verzoeken/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('header-switch-request-item')).toBeInTheDocument();
      expect(screen.getByTestId('header-switch-confirm')).toBeInTheDocument();
    });
  });

  it('shows 0 and does not call API when groupid is missing', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    });

    render(
      <HeaderSwitchRequests
        frontendBaseUrl={frontendBaseUrl}
        invalidateSwitchRequestUrl={invalidateSwitchRequestUrl}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Aantal verzoeken')).toHaveTextContent('0');
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('posts to frontend switch-change endpoint when confirming a request', async () => {
    render(
      <HeaderSwitchRequests
        frontendBaseUrl={frontendBaseUrl}
        invalidateSwitchRequestUrl={invalidateSwitchRequestUrl}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Aantal verzoeken')).toHaveTextContent('1');
    });

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /overname verzoeken/i }));

    await waitFor(() => {
      expect(screen.getByTestId('header-switch-confirm')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('header-switch-confirm'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `${frontendBaseUrl}/DoktersDienst/switch-change`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ diensten_id: 101, groupID: '42' }),
        })
      );
    });
  });

  it('posts to frontend switch-delete endpoint when declining a request', async () => {
    render(
      <HeaderSwitchRequests
        frontendBaseUrl={frontendBaseUrl}
        invalidateSwitchRequestUrl={invalidateSwitchRequestUrl}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Aantal verzoeken')).toHaveTextContent('1');
    });

    fireEvent.click(screen.getByRole('button', { name: /overname verzoeken/i }));

    await waitFor(() => {
      expect(screen.getByTestId('header-switch-decline')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('header-switch-decline'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `${frontendBaseUrl}/DoktersDienst/switch-delete`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ diensten_id: 101 }),
        })
      );
    });
  });

  it('posts to frontend switch-delete-all endpoint when deleting a declined request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: [makeSwitchItem({ delete_request: true, diensten_id: 202 })],
          count: 1,
        }),
    });

    render(
      <HeaderSwitchRequests
        frontendBaseUrl={frontendBaseUrl}
        invalidateSwitchRequestUrl={invalidateSwitchRequestUrl}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Aantal verzoeken')).toHaveTextContent('1');
    });

    fireEvent.click(screen.getByRole('button', { name: /overname verzoeken/i }));

    await waitFor(() => {
      expect(screen.getByTestId('header-switch-delete')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('header-switch-delete'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `${frontendBaseUrl}/DoktersDienst/switch-delete-all`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ diensten_id: 202 }),
        })
      );
    });
  });

  it('shows "Geen verzoeken" when list is empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [], count: 0 }),
    });

    render(
      <HeaderSwitchRequests
        frontendBaseUrl={frontendBaseUrl}
        invalidateSwitchRequestUrl={invalidateSwitchRequestUrl}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Aantal verzoeken')).toHaveTextContent('0');
    });

    fireEvent.click(screen.getByRole('button', { name: /overname verzoeken/i }));

    await waitFor(() => {
      expect(screen.getByText('Geen verzoeken')).toBeInTheDocument();
    });
  });
});
