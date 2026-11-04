/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRoosterMaand } from './useRoosterMaand';

afterEach(cleanup);

const SEPTEMBER = { month: 8, year: 2026 };

/** BroadcastChannel levert pas in een volgende tick af, ook binnen hetzelfde venster. */
async function laatBerichtenAankomen() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useRoosterMaand', () => {
  it('laat de Urentelling de maand van het rooster volgen', async () => {
    const rooster = renderHook(() => useRoosterMaand(10, SEPTEMBER));
    const urentelling = renderHook(() => useRoosterMaand(10, SEPTEMBER));

    act(() => rooster.result.current.setMaand(9, 2026));
    await laatBerichtenAankomen();

    expect(urentelling.result.current).toMatchObject({ month: 9, year: 2026 });
  });

  it('zet het rooster niet terug als er een tabblad opent', async () => {
    const rooster = renderHook(() => useRoosterMaand(10, { month: 9, year: 2026 }));
    renderHook(() => useRoosterMaand(10, SEPTEMBER));
    await laatBerichtenAankomen();

    expect(rooster.result.current).toMatchObject({ month: 9, year: 2026 });
  });

  it('negeert een andere waarneemgroep', async () => {
    const rooster = renderHook(() => useRoosterMaand(10, SEPTEMBER));
    const andereGroep = renderHook(() => useRoosterMaand(11, SEPTEMBER));

    act(() => rooster.result.current.setMaand(9, 2026));
    await laatBerichtenAankomen();

    expect(andereGroep.result.current).toMatchObject(SEPTEMBER);
  });
});
