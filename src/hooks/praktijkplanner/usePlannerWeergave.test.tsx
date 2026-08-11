/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePlannerWeergave } from './usePlannerWeergave';

afterEach(cleanup);

/** Twee schermen naast elkaar, zoals de planner ze open heeft staan. */
function tweeSchermen(idwaarneemgroep = 10) {
  return {
    links: renderHook(() => usePlannerWeergave(idwaarneemgroep)),
    rechts: renderHook(() => usePlannerWeergave(idwaarneemgroep)),
  };
}

/** BroadcastChannel levert pas in een volgende tick af, ook binnen hetzelfde venster. */
async function laatBerichtenAankomen() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('usePlannerWeergave', () => {
  it('zet de week van het ene scherm ook op het andere', async () => {
    const { links, rechts } = tweeSchermen();

    act(() => links.result.current.setWeekStart('2026-08-24'));
    await laatBerichtenAankomen();

    expect(rechts.result.current.weekStart).toBe('2026-08-24');
  });

  it('deelt ook de schakelaar week/maand', async () => {
    const { links, rechts } = tweeSchermen();

    act(() => links.result.current.setViewMode('month'));
    await laatBerichtenAankomen();

    expect(rechts.result.current.viewMode).toBe('month');
    expect(rechts.result.current.weekStart).toBe(links.result.current.weekStart);
  });

  it('laat een andere waarneemgroep met rust', async () => {
    const links = renderHook(() => usePlannerWeergave(10));
    const rechts = renderHook(() => usePlannerWeergave(11));
    const ongewijzigd = rechts.result.current.weekStart;

    act(() => links.result.current.setWeekStart('2026-08-24'));
    await laatBerichtenAankomen();

    expect(rechts.result.current.weekStart).toBe(ongewijzigd);
  });

  it('zendt bij het openen niets uit, zodat een nieuw scherm de rest niet terugzet', async () => {
    const links = renderHook(() => usePlannerWeergave(10));
    act(() => links.result.current.setWeekStart('2026-08-24'));
    await laatBerichtenAankomen();

    renderHook(() => usePlannerWeergave(10));
    await laatBerichtenAankomen();

    expect(links.result.current.weekStart).toBe('2026-08-24');
  });
});
