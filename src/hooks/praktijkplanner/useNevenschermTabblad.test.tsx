/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNevenschermTabblad } from './useNevenschermTabblad';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useNevenschermTabblad', () => {
  it('staat open na openen, en niet meer zodra het tabblad gesloten is', () => {
    vi.useFakeTimers();
    const tabblad = { focus: vi.fn(), closed: false };
    vi.spyOn(window, 'open').mockReturnValue(tabblad as unknown as Window);
    const { result } = renderHook(() => useNevenschermTabblad('praktijkplanner-nevenscherm'));

    expect(result.current.geopend).toBe(false);
    act(() => result.current.openen('/x?los=1'));
    expect(result.current.geopend).toBe(true);

    tabblad.closed = true;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.geopend).toBe(false);
  });

  it('blijft dicht als de browser het tabblad tegenhoudt', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const { result } = renderHook(() => useNevenschermTabblad('praktijkplanner-nevenscherm'));

    act(() => result.current.openen('/x?los=1'));

    expect(result.current.geopend).toBe(false);
  });
});
