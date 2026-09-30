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
