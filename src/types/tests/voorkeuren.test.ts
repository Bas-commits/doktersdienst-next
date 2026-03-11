import { describe, it, expect } from 'vitest';
import {
  buildPreferencePayload,
  shiftKey,
} from '../voorkeuren';
import type { RoosterChip } from '../rooster';

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
