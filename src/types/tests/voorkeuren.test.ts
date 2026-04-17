import { describe, it, expect } from 'vitest';
import {
  buildPreferencePayload,
  shiftKey,
  shiftKeyFromBlock,
  shouldApplyPreferencePaintEnter,
} from '../voorkeuren';
import type { RoosterChip } from '../rooster';
import type { ShiftBlockView } from '../diensten';

describe('buildPreferencePayload', () => {
  const baseChip: RoosterChip = {
    id: 1,
    date: '2026-02-15',
    day: 15,
    month: 2,
    year: 2026,
    type: 0,
    van: 8,
    tot: 20,
    startchip: '0px',
    chipboxwidth: '50%',
    IDdeelnemer: 42,
    current_date: '2026-02-15',
    next_date: '2026-02-15',
    Achterw_doctor: 0,
    Extra_doctor: 0,
    chip_part: 'Dag',
    start_time: '08:00',
    end_time: '20:00',
  };

  it('uses currentUserDoctorId for doctorid, not chip.IDdeelnemer (regression)', () => {
    const chips: RoosterChip[] = [baseChip];
    const key = shiftKey(baseChip.current_date, baseChip.van, baseChip.tot, baseChip.IDdeelnemer);
    const pendingInsert = new Map<string, string>([[key, '1006']]);
    const pendingDelete = new Set<string>();
    const groupId = '44';
    const currentUserDoctorId = 100;

    const { insert, delete: deleteItems } = buildPreferencePayload(
      chips,
      pendingInsert,
      pendingDelete,
      groupId,
      currentUserDoctorId
    );

    expect(insert).toHaveLength(1);
    expect(insert[0].doctorid).toBe(100);
    expect(insert[0].code).toBe('1006');
    expect(insert[0].GroupId).toBe('44');
    expect(deleteItems).toHaveLength(0);
  });

  it('uses currentUserDoctorId for delete items as well', () => {
    const chips: RoosterChip[] = [baseChip];
    const key = shiftKey(baseChip.current_date, baseChip.van, baseChip.tot, baseChip.IDdeelnemer);
    const pendingInsert = new Map<string, string>();
    const pendingDelete = new Set<string>([key]);
    const groupId = '1';
    const currentUserDoctorId = 200;

    const { insert, delete: deleteItems } = buildPreferencePayload(
      chips,
      pendingInsert,
      pendingDelete,
      groupId,
      currentUserDoctorId
    );

    expect(insert).toHaveLength(0);
    expect(deleteItems).toHaveLength(1);
    expect(deleteItems[0].doctorid).toBe(200);
    expect(deleteItems[0].code).toBe('1014');
  });
});

describe('shouldApplyPreferencePaintEnter', () => {
  it('returns false when session is not active or primary button not held', () => {
    const touched = new Set<string>();
    expect(shouldApplyPreferencePaintEnter(false, 1, 'a', touched)).toBe(false);
    expect(shouldApplyPreferencePaintEnter(true, 0, 'a', touched)).toBe(false);
  });

  it('returns false when key was already touched in this stroke', () => {
    const touched = new Set<string>(['a']);
    expect(shouldApplyPreferencePaintEnter(true, 1, 'a', touched)).toBe(false);
  });

  it('returns true when active, primary down, and key not yet touched', () => {
    const touched = new Set<string>();
    expect(shouldApplyPreferencePaintEnter(true, 1, 'b', touched)).toBe(true);
  });
});

describe('shiftKeyFromBlock', () => {
  it('returns key from currentDate, van, tot, id', () => {
    const block: ShiftBlockView = {
      id: 42,
      day: 15,
      month: 1,
      year: 2026,
      van: 1700000000,
      tot: 1700010800,
      startTime: '08:00',
      endTime: '20:00',
      currentDate: '2026-02-15 08:00:00',
      nextDate: '2026-02-15 20:00:00',
      middle: null,
      top: null,
      bottom: null,
    };
    expect(shiftKeyFromBlock(block)).toBe('2026-02-15 08:00:00_1700000000_1700010800_42');
  });
});
