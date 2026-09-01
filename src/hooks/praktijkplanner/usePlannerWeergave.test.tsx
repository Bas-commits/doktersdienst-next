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

  it('deelt ook de keuze van het nevenscherm', async () => {
    const { links, rechts } = tweeSchermen();

    act(() => links.result.current.setNevenscherm('maand'));
    await laatBerichtenAankomen();

    expect(rechts.result.current.nevenscherm).toBe('maand');
    expect(rechts.result.current.weekStart).toBe(links.result.current.weekStart);
  });

  it('deelt ook een nevenscherm dat het andere scherm zelf niet kent', async () => {
    const { links, rechts } = tweeSchermen();

    act(() => links.result.current.setNevenscherm('capaciteit'));
    await laatBerichtenAankomen();

    expect(rechts.result.current.nevenscherm).toBe('capaciteit');
  });

  it('laat een andere waarneemgroep met rust', async () => {
    const links = renderHook(() => usePlannerWeergave(10));
    const rechts = renderHook(() => usePlannerWeergave(11));
    const ongewijzigd = rechts.result.current.weekStart;

    act(() => links.result.current.setWeekStart('2026-08-24'));
    await laatBerichtenAankomen();

    expect(rechts.result.current.weekStart).toBe(ongewijzigd);
  });

  it('neemt de week mee naar het volgende scherm in hetzelfde tabblad', () => {
    // Van de Activiteiten planner naar de Afwezigheidsplanner klikken sluit het ene scherm en
    // opent het andere. Het kanaal helpt daar niet, want er staat niets meer open dat de week
    // kent.
    const activiteiten = renderHook(() => usePlannerWeergave(20));
    act(() => activiteiten.result.current.setWeekStart('2026-08-24'));
    activiteiten.unmount();

    const afwezigheid = renderHook(() => usePlannerWeergave(20));

    expect(afwezigheid.result.current.weekStart).toBe('2026-08-24');
  });

  it('neemt de week niet mee naar een ander scherm van een andere waarneemgroep', () => {
    const eerste = renderHook(() => usePlannerWeergave(21));
    act(() => eerste.result.current.setWeekStart('2026-08-24'));
    eerste.unmount();

    const tweede = renderHook(() => usePlannerWeergave(22));

    expect(tweede.result.current.weekStart).not.toBe('2026-08-24');
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
