import type { Dienst, DienstenResponse, DienstDeelnemer } from '@/types/diensten';

let nextId = 1000;

function nextAutoId(): number {
  return nextId++;
}

export function resetIdCounter(): void {
  nextId = 1000;
}

export function makeDeelnemer(overrides: Partial<DienstDeelnemer> = {}): DienstDeelnemer {
  return {
    id: overrides.id ?? nextAutoId(),
    voornaam: overrides.voornaam ?? 'Jan',
    achternaam: overrides.achternaam ?? 'Dokter',
    color: overrides.color ?? '#3b82f6',
  };
}

export function makeDienst(overrides: Partial<Dienst> & { type: number }): Dienst {
  return {
    id: overrides.id ?? nextAutoId(),
    iddeelnemer: overrides.iddeelnemer ?? 0,
    van: overrides.van ?? 1711918800, // 2024-04-01 07:00 UTC
    tot: overrides.tot ?? 1711951200, // 2024-04-01 16:00 UTC
    type: overrides.type,
    idwaarneemgroep: overrides.idwaarneemgroep ?? 9,
    status: overrides.status,
    iddienstovern: overrides.iddienstovern,
    iddeelnovern: overrides.iddeelnovern,
    senderId: overrides.senderId,
    idaantekening: overrides.idaantekening,
    aantekeningTekst: overrides.aantekeningTekst,
    diensten_deelnemers: overrides.diensten_deelnemers ?? null,
    target_deelnemers: overrides.target_deelnemers ?? null,
  };
}

/** Type=4 overname proposal with target doctor info. */
export function makeOvernameProposal(
  van: number,
  tot: number,
  wg: number,
  originalDeelnemer: DienstDeelnemer,
  targetDeelnemer: DienstDeelnemer,
  overrides: Partial<Dienst> = {}
): Dienst {
  return makeDienst({
    van,
    tot,
    idwaarneemgroep: wg,
    type: 4,
    status: 'pending',
    iddeelnemer: originalDeelnemer.id,
    diensten_deelnemers: originalDeelnemer,
    iddeelnovern: targetDeelnemer.id,
    target_deelnemers: targetDeelnemer,
    iddienstovern: overrides.iddienstovern ?? nextAutoId(),
    senderId: overrides.senderId ?? originalDeelnemer.id,
    ...overrides,
  });
}

/** Type=1 base slot (unassigned, defines time boundaries). */
export function makeBaseSlot(
  van: number,
  tot: number,
  wg: number,
  overrides: Partial<Dienst> = {}
): Dienst {
  return makeDienst({
    van,
    tot,
    idwaarneemgroep: wg,
    type: 1,
    iddeelnemer: 0,
    diensten_deelnemers: null,
    ...overrides,
  });
}

/** Type=0 Standaard assignment (middle stripe). */
export function makeStandaardAssignment(
  van: number,
  tot: number,
  wg: number,
  deelnemer: DienstDeelnemer,
  overrides: Partial<Dienst> = {}
): Dienst {
  return makeDienst({
    van,
    tot,
    idwaarneemgroep: wg,
    type: 0,
    iddeelnemer: deelnemer.id,
    diensten_deelnemers: deelnemer,
    ...overrides,
  });
}

/** Type=5 Achterwacht assignment (top stripe). */
export function makeAchterwachtAssignment(
  van: number,
  tot: number,
  wg: number,
  deelnemer: DienstDeelnemer,
  overrides: Partial<Dienst> = {}
): Dienst {
  return makeDienst({
    van,
    tot,
    idwaarneemgroep: wg,
    type: 5,
    iddeelnemer: deelnemer.id,
    diensten_deelnemers: deelnemer,
    ...overrides,
  });
}

/** Type=11 Extra Dokter assignment (bottom stripe). */
export function makeExtraDokterAssignment(
  van: number,
  tot: number,
  wg: number,
  deelnemer: DienstDeelnemer,
  overrides: Partial<Dienst> = {}
): Dienst {
  return makeDienst({
    van,
    tot,
    idwaarneemgroep: wg,
    type: 11,
    iddeelnemer: deelnemer.id,
    diensten_deelnemers: deelnemer,
    ...overrides,
  });
}

/** Wrap diensten array into a DienstenResponse. */
export function makeDienstenResponse(diensten: Dienst[]): DienstenResponse {
  return { data: { diensten } };
}

// Convenient timestamps for a typical shift day
// 2024-04-01 (Monday) in UTC
export const SHIFT_VAN = 1711918800; // 07:00 UTC
export const SHIFT_TOT = 1711951200; // 16:00 UTC
export const WG_ID = 9;
