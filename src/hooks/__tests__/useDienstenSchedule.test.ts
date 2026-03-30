import { describe, it, expect, beforeEach } from 'vitest';
import {
  dienstenToShiftBlocks,
  intervalsOverlap,
  toDoctorInfo,
  groupShiftBlocksByWaarneemgroep,
} from '@/hooks/useDienstenSchedule';
import {
  makeBaseSlot,
  makeStandaardAssignment,
  makeAchterwachtAssignment,
  makeExtraDokterAssignment,
  makeOvernameProposal,
  makeDienst,
  makeDeelnemer,
  makeDienstenResponse,
  resetIdCounter,
  SHIFT_VAN,
  SHIFT_TOT,
  WG_ID,
} from './fixtures';

beforeEach(() => {
  resetIdCounter();
});

// ---------------------------------------------------------------------------
// Helper: intervalsOverlap
// ---------------------------------------------------------------------------
describe('intervalsOverlap', () => {
  it('returns true for identical intervals', () => {
    expect(intervalsOverlap(100, 200, 100, 200)).toBe(true);
  });

  it('returns true for overlapping intervals', () => {
    expect(intervalsOverlap(100, 200, 150, 250)).toBe(true);
  });

  it('returns true when one contains the other', () => {
    expect(intervalsOverlap(100, 300, 150, 250)).toBe(true);
  });

  it('returns false for adjacent non-overlapping intervals', () => {
    expect(intervalsOverlap(100, 200, 200, 300)).toBe(false);
  });

  it('returns false for completely separate intervals', () => {
    expect(intervalsOverlap(100, 200, 300, 400)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Helper: toDoctorInfo
// ---------------------------------------------------------------------------
describe('toDoctorInfo', () => {
  it('returns DoctorInfo for a valid dienst with deelnemers', () => {
    const deelnemer = makeDeelnemer({ id: 42, voornaam: 'Anna', achternaam: 'Berg', color: '#ff0000' });
    const dienst = makeDienst({ type: 0, diensten_deelnemers: deelnemer, iddeelnemer: 42 });
    const info = toDoctorInfo(dienst);

    expect(info).toEqual({
      id: 42,
      name: 'Anna Berg',
      shortName: 'AB',
      color: '#ff0000',
    });
  });

  it('returns null when diensten_deelnemers is null', () => {
    const dienst = makeDienst({ type: 0, diensten_deelnemers: null });
    expect(toDoctorInfo(dienst)).toBeNull();
  });

  it('handles empty name strings gracefully', () => {
    const deelnemer = makeDeelnemer({ id: 1, voornaam: '', achternaam: '', color: '' });
    const dienst = makeDienst({ type: 0, diensten_deelnemers: deelnemer, iddeelnemer: 1 });
    const info = toDoctorInfo(dienst);

    expect(info).not.toBeNull();
    expect(info!.name).toBe('Doctor 1');
    expect(info!.color).toBe('#c686fd'); // fallback color
  });
});

// ---------------------------------------------------------------------------
// US1: dienstenToShiftBlocks — Middle (Standaard) stripe
// ---------------------------------------------------------------------------
describe('dienstenToShiftBlocks — middle stripe (US1)', () => {
  it('T006: base slot only → block with null middle/top/bottom', () => {
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const response = makeDienstenResponse([base]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].middle).toBeNull();
    expect(blocks[0].top).toBeNull();
    expect(blocks[0].bottom).toBeNull();
    expect(blocks[0].van).toBe(SHIFT_VAN);
    expect(blocks[0].tot).toBe(SHIFT_TOT);
    expect(blocks[0].idwaarneemgroep).toBe(WG_ID);
  });

  it('T007: base + type=0 → middle populated with correct DoctorInfo', () => {
    const deelnemer = makeDeelnemer({ id: 42, voornaam: 'Piet', achternaam: 'Arts' });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const standaard = makeStandaardAssignment(SHIFT_VAN, SHIFT_TOT, WG_ID, deelnemer);
    const response = makeDienstenResponse([base, standaard]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].middle).not.toBeNull();
    expect(blocks[0].middle!.id).toBe(42);
    expect(blocks[0].middle!.name).toBe('Piet Arts');
    expect(blocks[0].middle!.shortName).toBe('PA');
  });

  it('T008: base + type=4 (legacy) → middle populated', () => {
    const deelnemer = makeDeelnemer({ id: 43 });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const legacy4 = makeDienst({
      type: 4,
      van: SHIFT_VAN,
      tot: SHIFT_TOT,
      idwaarneemgroep: WG_ID,
      iddeelnemer: 43,
      diensten_deelnemers: deelnemer,
    });
    const response = makeDienstenResponse([base, legacy4]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].middle).not.toBeNull();
    expect(blocks[0].middle!.id).toBe(43);
  });

  it('T009: base + type=6 (legacy) → middle populated', () => {
    const deelnemer = makeDeelnemer({ id: 44 });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const legacy6 = makeDienst({
      type: 6,
      van: SHIFT_VAN,
      tot: SHIFT_TOT,
      idwaarneemgroep: WG_ID,
      iddeelnemer: 44,
      diensten_deelnemers: deelnemer,
    });
    const response = makeDienstenResponse([base, legacy6]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].middle).not.toBeNull();
    expect(blocks[0].middle!.id).toBe(44);
  });

  it('T010: wide Standaard row (different van/tot) → middle via overlap fallback', () => {
    const deelnemer = makeDeelnemer({ id: 45 });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    // Wide standaard: starts 1 hour before and ends 1 hour after the base slot
    const wideStandaard = makeStandaardAssignment(
      SHIFT_VAN - 3600,
      SHIFT_TOT + 3600,
      WG_ID,
      deelnemer
    );
    const response = makeDienstenResponse([base, wideStandaard]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].middle).not.toBeNull();
    expect(blocks[0].middle!.id).toBe(45);
  });

  it('returns empty when response is null', () => {
    expect(dienstenToShiftBlocks(null)).toEqual([]);
  });

  it('returns empty when response has empty diensten', () => {
    expect(dienstenToShiftBlocks(makeDienstenResponse([]))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// US2: dienstenToShiftBlocks — Top (Achterwacht) stripe
// ---------------------------------------------------------------------------
describe('dienstenToShiftBlocks — top stripe (US2)', () => {
  it('T024: base + type=5 → top populated with correct DoctorInfo', () => {
    const deelnemer = makeDeelnemer({ id: 50, voornaam: 'Karin', achternaam: 'Wacht' });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const achterwacht = makeAchterwachtAssignment(SHIFT_VAN, SHIFT_TOT, WG_ID, deelnemer);
    const response = makeDienstenResponse([base, achterwacht]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].top).not.toBeNull();
    expect(blocks[0].top!.id).toBe(50);
    expect(blocks[0].top!.name).toBe('Karin Wacht');
    expect(blocks[0].top!.shortName).toBe('KW');
  });

  it('split achterwacht (partial van/tot) populates top via overlap fallback', () => {
    const deelnemer = makeDeelnemer({ id: 51, voornaam: 'Split', achternaam: 'Wacht' });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID); // 07:00 - 16:00
    // Type=5 record covers only the first half of the base slot
    const splitAchterwacht = makeAchterwachtAssignment(
      SHIFT_VAN,
      SHIFT_VAN + 4 * 3600, // 07:00 - 11:00 (partial)
      WG_ID,
      deelnemer
    );
    const response = makeDienstenResponse([base, splitAchterwacht]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].top).not.toBeNull();
    expect(blocks[0].top!.id).toBe(51);
  });
});

// ---------------------------------------------------------------------------
// US3: dienstenToShiftBlocks — Bottom (Extra Dokter) stripe
// ---------------------------------------------------------------------------
describe('dienstenToShiftBlocks — bottom stripe (US3)', () => {
  it('T033: base + type=9 → bottom populated', () => {
    const deelnemer = makeDeelnemer({ id: 60, voornaam: 'Lisa', achternaam: 'Extra' });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const extra = makeExtraDokterAssignment(SHIFT_VAN, SHIFT_TOT, WG_ID, deelnemer);
    const response = makeDienstenResponse([base, extra]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].bottom).not.toBeNull();
    expect(blocks[0].bottom!.id).toBe(60);
    expect(blocks[0].bottom!.name).toBe('Lisa Extra');
  });

  it('T034: base + type=11 (deprecated) → bottom populated', () => {
    const deelnemer = makeDeelnemer({ id: 61 });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const deprecated11 = makeDienst({
      type: 11,
      van: SHIFT_VAN,
      tot: SHIFT_TOT,
      idwaarneemgroep: WG_ID,
      iddeelnemer: 61,
      diensten_deelnemers: deelnemer,
    });
    const response = makeDienstenResponse([base, deprecated11]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].bottom).not.toBeNull();
    expect(blocks[0].bottom!.id).toBe(61);
  });

  it('split Extra Dokter (partial van/tot) populates bottom via overlap fallback', () => {
    const deelnemer = makeDeelnemer({ id: 62, voornaam: 'Split', achternaam: 'Extra' });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID); // 07:00 - 16:00
    // Type=9 record covers only the second half of the base slot
    const splitExtra = makeExtraDokterAssignment(
      SHIFT_VAN + 4 * 3600, // 11:00
      SHIFT_TOT,            // 16:00 (partial)
      WG_ID,
      deelnemer
    );
    const response = makeDienstenResponse([base, splitExtra]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].bottom).not.toBeNull();
    expect(blocks[0].bottom!.id).toBe(62);
  });
});

// ---------------------------------------------------------------------------
// US4: All three stripes simultaneously
// ---------------------------------------------------------------------------
describe('dienstenToShiftBlocks — all stripes combined (US4)', () => {
  it('T044: base + type=0 + type=5 + type=9 → all three stripes populated', () => {
    const middleDoc = makeDeelnemer({ id: 70, voornaam: 'A', achternaam: 'Mid' });
    const topDoc = makeDeelnemer({ id: 71, voornaam: 'B', achternaam: 'Top' });
    const bottomDoc = makeDeelnemer({ id: 72, voornaam: 'C', achternaam: 'Bot' });

    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const middle = makeStandaardAssignment(SHIFT_VAN, SHIFT_TOT, WG_ID, middleDoc);
    const top = makeAchterwachtAssignment(SHIFT_VAN, SHIFT_TOT, WG_ID, topDoc);
    const bottom = makeExtraDokterAssignment(SHIFT_VAN, SHIFT_TOT, WG_ID, bottomDoc);

    const response = makeDienstenResponse([base, middle, top, bottom]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].middle).not.toBeNull();
    expect(blocks[0].middle!.id).toBe(70);
    expect(blocks[0].top).not.toBeNull();
    expect(blocks[0].top!.id).toBe(71);
    expect(blocks[0].bottom).not.toBeNull();
    expect(blocks[0].bottom!.id).toBe(72);
  });
});

// ---------------------------------------------------------------------------
// US5: Multiple base slots & edge cases
// ---------------------------------------------------------------------------
describe('dienstenToShiftBlocks — persistence & grouping (US5)', () => {
  it('T050: no base record (type=1 missing) → no blocks produced', () => {
    // Only assignment records, no base slot
    const deelnemer = makeDeelnemer({ id: 80 });
    const orphan = makeStandaardAssignment(SHIFT_VAN, SHIFT_TOT, WG_ID, deelnemer);
    const response = makeDienstenResponse([orphan]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(0);
  });

  it('T051: multiple base slots with independent assignments → separate blocks', () => {
    const doc1 = makeDeelnemer({ id: 81, voornaam: 'Doc', achternaam: 'One' });
    const doc2 = makeDeelnemer({ id: 82, voornaam: 'Doc', achternaam: 'Two' });

    const morningVan = SHIFT_VAN;
    const morningTot = SHIFT_VAN + 4 * 3600; // 4 hours
    const afternoonVan = morningTot;
    const afternoonTot = morningTot + 4 * 3600;

    const base1 = makeBaseSlot(morningVan, morningTot, WG_ID);
    const assign1 = makeStandaardAssignment(morningVan, morningTot, WG_ID, doc1);
    const base2 = makeBaseSlot(afternoonVan, afternoonTot, WG_ID);
    const assign2 = makeStandaardAssignment(afternoonVan, afternoonTot, WG_ID, doc2);

    const response = makeDienstenResponse([base1, assign1, base2, assign2]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(2);
    const morningBlock = blocks.find((b) => b.van === morningVan);
    const afternoonBlock = blocks.find((b) => b.van === afternoonVan);
    expect(morningBlock?.middle?.id).toBe(81);
    expect(afternoonBlock?.middle?.id).toBe(82);
  });
});

// ---------------------------------------------------------------------------
// Preference types must NOT leak into shift blocks
// ---------------------------------------------------------------------------
describe('dienstenToShiftBlocks — preference types must not leak', () => {
  it('type=9 preference (Vakantie) leaks into bottom stripe when unfiltered — proves the bug', () => {
    // This test documents the type=9 dual-meaning problem:
    // If the API returns unfiltered diensten, type=9 preferences get treated as
    // Extra Dokter assignments. The fix is at the data-fetching layer:
    // rooster-maken-secretaris and rooster-inzien must request only assignment types.
    const vacationDoctor = makeDeelnemer({ id: 100, voornaam: 'Vakantie', achternaam: 'Dokter' });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const vakantiePreference = makeDienst({
      type: 9,
      van: SHIFT_VAN,
      tot: SHIFT_TOT,
      idwaarneemgroep: WG_ID,
      iddeelnemer: vacationDoctor.id,
      diensten_deelnemers: vacationDoctor,
    });
    const response = makeDienstenResponse([base, vakantiePreference]);
    const blocks = dienstenToShiftBlocks(response);

    // Without upstream filtering, type=9 DOES leak into bottom stripe.
    // dienstenToShiftBlocks cannot distinguish the dual meaning — the fix
    // must be at the subscription call site (pass typeIn=[0,1,4,5,6,9,11]).
    expect(blocks).toHaveLength(1);
    expect(blocks[0].bottom).not.toBeNull(); // This IS the bug: preference leaks as assignment
  });

  it('type=2 (Liever niet) and type=3 (Liever wel) must be ignored entirely', () => {
    const doc = makeDeelnemer({ id: 101 });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const lieverNiet = makeDienst({
      type: 2,
      van: SHIFT_VAN,
      tot: SHIFT_TOT,
      idwaarneemgroep: WG_ID,
      iddeelnemer: doc.id,
      diensten_deelnemers: doc,
    });
    const lieverWel = makeDienst({
      type: 3,
      van: SHIFT_VAN,
      tot: SHIFT_TOT,
      idwaarneemgroep: WG_ID,
      iddeelnemer: doc.id,
      diensten_deelnemers: doc,
    });
    const response = makeDienstenResponse([base, lieverNiet, lieverWel]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].middle).toBeNull();
    expect(blocks[0].top).toBeNull();
    expect(blocks[0].bottom).toBeNull();
  });

  it('type=10 (Nascholing) and type=5001 (FTE) must be ignored entirely', () => {
    const doc = makeDeelnemer({ id: 102 });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const nascholing = makeDienst({
      type: 10,
      van: SHIFT_VAN,
      tot: SHIFT_TOT,
      idwaarneemgroep: WG_ID,
      iddeelnemer: doc.id,
      diensten_deelnemers: doc,
    });
    const fte = makeDienst({
      type: 5001,
      van: SHIFT_VAN,
      tot: SHIFT_TOT,
      idwaarneemgroep: WG_ID,
      iddeelnemer: doc.id,
      diensten_deelnemers: doc,
    });
    const response = makeDienstenResponse([base, nascholing, fte]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].middle).toBeNull();
    expect(blocks[0].top).toBeNull();
    expect(blocks[0].bottom).toBeNull();
  });

  it('real type=9 Extra Dokter assignment must still appear in bottom stripe', () => {
    // A real Extra Dokter assignment also has type=9, but is a proper assignment
    // The distinction is context: when fetched with assignment-type filters,
    // type=9 records are assignments. When fetched with preference-type filters, they're preferences.
    // dienstenToShiftBlocks should handle both since it receives already-filtered data.
    const doc = makeDeelnemer({ id: 103, voornaam: 'Extra', achternaam: 'Dokter' });
    const base = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const extraDokter = makeExtraDokterAssignment(SHIFT_VAN, SHIFT_TOT, WG_ID, doc);
    const response = makeDienstenResponse([base, extraDokter]);
    const blocks = dienstenToShiftBlocks(response);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].bottom).not.toBeNull();
    expect(blocks[0].bottom!.id).toBe(103);
  });
});

// ---------------------------------------------------------------------------
// groupShiftBlocksByWaarneemgroep
// ---------------------------------------------------------------------------
describe('groupShiftBlocksByWaarneemgroep (US4)', () => {
  it('T045: groups blocks by idwaarneemgroep', () => {
    const doc = makeDeelnemer({ id: 90 });

    const base1 = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, 9);
    const assign1 = makeStandaardAssignment(SHIFT_VAN, SHIFT_TOT, 9, doc);
    const base2 = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, 45);
    const assign2 = makeStandaardAssignment(SHIFT_VAN, SHIFT_TOT, 45, doc);

    const response = makeDienstenResponse([base1, assign1, base2, assign2]);
    const blocks = dienstenToShiftBlocks(response);
    const rows = groupShiftBlocksByWaarneemgroep(blocks);

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(9);
    expect(rows[1].id).toBe(45);
    expect(rows[0].shiftBlocks).toHaveLength(1);
    expect(rows[1].shiftBlocks).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Overname overlay blocks
// ---------------------------------------------------------------------------
describe('dienstenToShiftBlocks — overname overlay blocks', () => {
  it('overlay block uses target doctor for middle, stores original in originalDoctor', () => {
    const originalDoc = makeDeelnemer({ id: 50, voornaam: 'Piet', achternaam: 'Origineel', color: '#ff0000' });
    const targetDoc = makeDeelnemer({ id: 60, voornaam: 'Jan', achternaam: 'Doelarts', color: '#00ff00' });
    const slot = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const proposal = makeOvernameProposal(SHIFT_VAN, SHIFT_TOT, WG_ID, originalDoc, targetDoc, {
      iddienstovern: slot.id,
      senderId: 50,
    });

    const blocks = dienstenToShiftBlocks(makeDienstenResponse([slot, proposal]));
    const overlay = blocks.find((b) => b.overnameType === 'voorstelOvername');

    expect(overlay).toBeDefined();
    // middle should be the TARGET doctor
    expect(overlay!.middle?.id).toBe(60);
    expect(overlay!.middle?.color).toBe('#00ff00');
    expect(overlay!.middle?.shortName).toBe('JD');
    // originalDoctor should be the ORIGINAL doctor
    expect(overlay!.originalDoctor?.id).toBe(50);
    expect(overlay!.originalDoctor?.color).toBe('#ff0000');
    // iddienstovern and senderId should be propagated
    expect(overlay!.iddienstovern).toBe(slot.id);
    expect(overlay!.senderId).toBe(50);
  });

  it('overlay block falls back to original doctor when target_deelnemers is null', () => {
    const originalDoc = makeDeelnemer({ id: 50, voornaam: 'Piet', achternaam: 'Origineel', color: '#ff0000' });
    const slot = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const proposal = makeDienst({
      type: 4,
      van: SHIFT_VAN,
      tot: SHIFT_TOT,
      idwaarneemgroep: WG_ID,
      status: 'pending',
      iddeelnemer: originalDoc.id,
      diensten_deelnemers: originalDoc,
      target_deelnemers: null,
      iddienstovern: slot.id,
    });

    const blocks = dienstenToShiftBlocks(makeDienstenResponse([slot, proposal]));
    const overlay = blocks.find((b) => b.overnameType === 'voorstelOvername');

    expect(overlay).toBeDefined();
    // Falls back to original doctor
    expect(overlay!.middle?.id).toBe(50);
  });

  it('declined overlay block has middle=null (gray, no initials)', () => {
    const originalDoc = makeDeelnemer({ id: 50, voornaam: 'Piet', achternaam: 'Origineel', color: '#ff0000' });
    const targetDoc = makeDeelnemer({ id: 60, voornaam: 'Jan', achternaam: 'Doelarts', color: '#00ff00' });
    const slot = makeBaseSlot(SHIFT_VAN, SHIFT_TOT, WG_ID);
    const declined = makeOvernameProposal(SHIFT_VAN, SHIFT_TOT, WG_ID, originalDoc, targetDoc, {
      iddienstovern: slot.id,
      status: 'declined',
    });

    const blocks = dienstenToShiftBlocks(makeDienstenResponse([slot, declined]));
    const overlay = blocks.find((b) => b.overnameType === 'vraagtekenOvername');

    expect(overlay).toBeDefined();
    // Declined: middle should be null (gray block, no initials)
    expect(overlay!.middle).toBeNull();
    // Original doctor should still be stored
    expect(overlay!.originalDoctor?.id).toBe(50);
  });
});
