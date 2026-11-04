/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ShiftBlock } from './ShiftBlock';
import type { DoctorInfo, ShiftBlockView } from '@/types/diensten';

afterEach(cleanup);

const doctor = (id: number, name: string, color: string): DoctorInfo => ({
  id,
  name,
  shortName: name.slice(0, 2).toUpperCase(),
  color,
});

function makeBlock(overrides: Partial<ShiftBlockView> = {}): ShiftBlockView {
  return {
    id: 1,
    day: 5,
    month: 9,
    year: 2099,
    van: 4_095_000_000,
    tot: 4_095_032_400,
    startTime: '08:00',
    endTime: '17:00',
    currentDate: '2099-10-05 08:00:00',
    nextDate: '2099-10-05 17:00:00',
    middle: doctor(10, 'Anna Dienst', '#3366ff'),
    top: doctor(20, 'Bert Achter', '#ff6633'),
    bottom: doctor(30, 'Carla Extra', '#33aa55'),
    ...overrides,
  };
}

function renderBlock(block: ShiftBlockView) {
  // CalendarGrid passes overnameType as its own prop, next to the block that carries it.
  return render(
    <ShiftBlock
      block={block}
      day={block.day}
      month={block.month}
      year={block.year}
      overnameType={block.overnameType}
    />
  );
}

function tooltip(): HTMLElement | null {
  return document.body.querySelector('[data-shift-block-tooltip]');
}

/** A block that runs from an hour ago until an hour from now, in local "YYYY-MM-DD HH:MM:SS". */
function makeRunningBlock(overrides: Partial<ShiftBlockView> = {}): ShiftBlockView {
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  const start = new Date(Date.now() - 60 * 60_000);
  const end = new Date(Date.now() + 60 * 60_000);
  return makeBlock({
    day: start.getDate(),
    month: start.getMonth(),
    year: start.getFullYear(),
    van: Math.floor(start.getTime() / 1000),
    tot: Math.floor(end.getTime() / 1000),
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    currentDate: local(start),
    nextDate: local(end),
    ...overrides,
  });
}

describe('ShiftBlock markering actuele dienst', () => {
  it('zet een groene rand om de hele dienst die nu loopt, achterwacht en extra dokter incluis', () => {
    renderBlock(makeRunningBlock());

    const frame = screen.getByTestId('shift-block-active-frame');
    expect(frame.style.borderColor).toBe('green');
    // The frame hangs off the outer container, so it encloses all three lanes.
    const outer = screen.getByTestId('shift-block-middle').closest('[data-box-type="morning"]')!;
    expect(frame.parentElement).toBe(outer);
    expect(outer.contains(screen.getByTestId('shift-block-top'))).toBe(true);
    expect(outer.contains(screen.getByTestId('shift-block-bottom'))).toBe(true);
    // The old red border on the middle block alone is gone.
    expect(screen.getByTestId('shift-block-middle').style.borderColor).not.toBe('rgb(220, 38, 38)');
  });

  it('laat de rand open aan de kant waar een nachtdienst doorloopt in de volgende dag', () => {
    render(
      <ShiftBlock
        block={makeRunningBlock()}
        day={1}
        month={0}
        year={2000}
        continuesToNext
      />
    );

    const frame = screen.getByTestId('shift-block-active-frame');
    expect(frame.style.borderRightWidth).toBe('0px');
    expect(frame.style.borderLeftWidth).toBe('3px');
  });

  it('markeert een dienst die nog moet komen niet', () => {
    renderBlock(makeBlock());

    expect(screen.queryByTestId('shift-block-active-frame')).toBeNull();
  });
});

describe('ShiftBlock hover tooltip', () => {
  it('toont bij de achterwacht de rol, de naam en de tijden', () => {
    renderBlock(makeBlock());

    act(() => {
      fireEvent.mouseEnter(screen.getByTestId('shift-block-top'));
    });

    const tip = tooltip();
    expect(tip).not.toBeNull();
    expect(tip!.textContent).toContain('Achterwacht');
    expect(tip!.textContent).toContain('Bert Achter');
    expect(tip!.textContent).toContain('08:00');
    expect(tip!.textContent).toContain('17:00');
    expect(tip!.textContent).not.toContain('Anna Dienst');
  });

  it('toont bij de extra dokter de rol en de naam', () => {
    renderBlock(makeBlock());

    act(() => {
      fireEvent.mouseEnter(screen.getByTestId('shift-block-bottom'));
    });

    const tip = tooltip();
    expect(tip!.textContent).toContain('Extra dokter');
    expect(tip!.textContent).toContain('Carla Extra');
  });

  it('verdwijnt weer als de muis de strook verlaat', () => {
    renderBlock(makeBlock());
    const strook = screen.getByTestId('shift-block-top');

    act(() => {
      fireEvent.mouseEnter(strook);
    });
    act(() => {
      fireEvent.mouseLeave(strook);
    });

    expect(tooltip()).toBeNull();
  });

  it('opent niets op een lege strook', () => {
    renderBlock(makeBlock({ top: null, bottom: null }));

    act(() => {
      fireEvent.mouseEnter(screen.getByTestId('shift-block-top'));
    });

    expect(tooltip()).toBeNull();
  });

  it('laat een overname-overlay de muis doorlaten, behalve op zijn eigen middelste vak', () => {
    // Het overlay-blok ligt precies over de oorspronkelijke dienst. Pakte het de muis, dan
    // kreeg de achterwacht-strook eronder nooit een tooltip.
    renderBlock(makeBlock({ overnameType: 'voorstelOvername', top: null, bottom: null }));

    const middle = screen.getByTestId('shift-block-middle');
    const outer = middle.closest<HTMLElement>('[data-box-type="morning"]')!;
    expect(outer.style.pointerEvents).toBe('none');
    expect(middle.style.pointerEvents).toBe('auto');
  });

  it('laat een gewone dienst de muis gewoon opvangen', () => {
    renderBlock(makeBlock());

    const outer = screen.getByTestId('shift-block-middle').closest<HTMLElement>('[data-box-type="morning"]')!;
    expect(outer.style.pointerEvents).toBe('');
  });

  it('houdt de gewone tooltip op het middelste vak zonder rol', () => {
    renderBlock(makeBlock());

    act(() => {
      fireEvent.mouseEnter(screen.getByTestId('shift-block-middle'));
    });

    const tip = tooltip();
    expect(tip!.textContent).toContain('Anna Dienst');
    expect(tip!.textContent).not.toContain('Achterwacht');
    expect(tip!.textContent).not.toContain('Extra dokter');
  });
});

describe('ShiftBlock overname van achterwacht / extra dokter', () => {
  const laneBlock = (sectie: 'top' | 'bottom') =>
    makeBlock({
      overnameType: 'voorstelOvername',
      overnameSectie: sectie,
      middle: doctor(40, 'Dirk Doel', '#aa33cc'),
      originalDoctor: doctor(20, 'Bert Achter', '#ff6633'),
      top: null,
      bottom: null,
    });

  it('tekent het voorstel op de achterwacht-strook en laat het middelste vak leeg', () => {
    renderBlock(laneBlock('top'));

    const strook = screen.getByTestId('shift-block-top');
    expect(strook.dataset.overnameSectie).toBe('top');
    // Zolang het een voorstel is staat de oorspronkelijke achterwacht er nog, net als bij een dienst.
    expect(strook.dataset.doctor).toBe('20');
    expect(strook.querySelector('[data-testid="voorstel-overname-badge"]')).not.toBeNull();
    expect(screen.getByTestId('shift-block-middle').style.visibility).toBe('hidden');
    // De extra-dokter-strook van de dienst eronder moet zichtbaar blijven.
    expect(screen.queryByTestId('shift-block-bottom')).toBeNull();
  });

  it('tekent een extra-dokter-voorstel op de onderste strook', () => {
    renderBlock(laneBlock('bottom'));

    expect(screen.getByTestId('shift-block-bottom').dataset.overnameSectie).toBe('bottom');
    expect(screen.queryByTestId('shift-block-top')).toBeNull();
  });

  it('opent bij een klik op de strook het voorstel van die strook', () => {
    const block = laneBlock('top');
    const clicks: string[] = [];
    render(
      <ShiftBlock
        block={block}
        day={block.day}
        month={block.month}
        year={block.year}
        overnameType={block.overnameType}
        onSectionClick={(section) => clicks.push(section)}
      />
    );

    fireEvent.click(screen.getByTestId('shift-block-top'));
    expect(clicks).toEqual(['top']);
  });

  it('noemt in de tooltip de rol en dat het een voorstel is', () => {
    renderBlock(laneBlock('top'));

    act(() => {
      fireEvent.mouseEnter(screen.getByTestId('shift-block-top'));
    });

    const tip = tooltip();
    expect(tip!.textContent).toContain('Achterwacht · voorstel overname');
    expect(tip!.textContent).toContain('Bert Achter');
  });

  it('zet na acceptatie de nieuwe achterwacht op de strook', () => {
    renderBlock({ ...laneBlock('top'), overnameType: 'overname' });

    const strook = screen.getByTestId('shift-block-top');
    expect(strook.dataset.doctor).toBe('40');
    expect(strook.querySelector('[data-testid="overname-badge"]')).not.toBeNull();

    act(() => {
      fireEvent.mouseEnter(strook);
    });
    expect(tooltip()!.textContent).toContain('Dirk Doel');
  });

  it('houdt een gewoon dienstvoorstel in het middelste vak', () => {
    renderBlock(makeBlock({ overnameType: 'voorstelOvername', top: null, bottom: null }));

    expect(screen.getByTestId('shift-block-middle').style.visibility).not.toBe('hidden');
    expect(screen.queryByTestId('shift-block-top')).toBeNull();
  });
});

describe('ShiftBlock na afloop', () => {
  const voorbij = () =>
    makeBlock({ day: 1, month: 0, year: 2020, van: 1577869200, tot: 1577901600, currentDate: '2020-01-01 08:00:00', nextDate: '2020-01-01 17:00:00' });

  it('zegt bij een klik op een afgelopen dienst waarom er niets gebeurt', () => {
    const block = voorbij();
    const clicks: string[] = [];
    const endedClicks: number[] = [];
    render(
      <ShiftBlock
        block={block}
        day={block.day}
        month={block.month}
        year={block.year}
        disableWhenEnded
        onClick={() => clicks.push('click')}
        onEndedClick={() => endedClicks.push(1)}
      />
    );

    fireEvent.click(screen.getByTestId('shift-block-middle'));

    // De gewone klik blijft geblokkeerd; alleen de uitleg komt.
    expect(clicks).toEqual([]);
    expect(endedClicks).toEqual([1]);
  });

  it('roept de uitleg niet aan bij een dienst die nog moet komen', () => {
    const block = makeBlock();
    const endedClicks: number[] = [];
    render(
      <ShiftBlock
        block={block}
        day={block.day}
        month={block.month}
        year={block.year}
        disableWhenEnded
        onClick={() => undefined}
        onEndedClick={() => endedClicks.push(1)}
      />
    );

    fireEvent.click(screen.getByTestId('shift-block-middle'));
    expect(endedClicks).toEqual([]);
  });
});
