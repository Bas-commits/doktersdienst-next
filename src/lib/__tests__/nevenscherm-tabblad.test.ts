/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { losTabbladParams, nevenschermTabbladUrl, openNevenschermTabblad } from '@/lib/nevenscherm-tabblad';

describe('nevenschermTabbladUrl', () => {
  it('zet los=1 en de beginstand in de query', () => {
    expect(
      nevenschermTabbladUrl('/praktijkplanner/activiteiten', { nevenscherm: 'capaciteit', week: '2026-09-28' })
    ).toBe('/praktijkplanner/activiteiten?los=1&nevenscherm=capaciteit&week=2026-09-28');
  });
});

describe('losTabbladParams', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('herkent het losse tabblad', () => {
    window.history.replaceState(null, '', '/praktijkplanner/activiteiten?los=1&week=2026-09-28');
    expect(losTabbladParams()?.get('week')).toBe('2026-09-28');
  });

  it('geeft null in het gewone tabblad', () => {
    window.history.replaceState(null, '', '/praktijkplanner/activiteiten');
    expect(losTabbladParams()).toBeNull();
  });
});

describe('openNevenschermTabblad', () => {
  it('opent onder een vaste naam, zodat een tweede klik hetzelfde tabblad hergebruikt', () => {
    const focus = vi.fn();
    const tabblad = { focus } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(tabblad);

    expect(openNevenschermTabblad('/x?los=1', 'praktijkplanner-nevenscherm')).toBe(tabblad);

    expect(open).toHaveBeenCalledWith('/x?los=1', 'praktijkplanner-nevenscherm');
    expect(focus).toHaveBeenCalled();
    open.mockRestore();
  });
});
