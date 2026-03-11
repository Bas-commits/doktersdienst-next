import type { RoosterChip, OverWriteChipItem, VakantieItem } from './rooster';

export type { RoosterChip, OverWriteChipItem, VakantieItem };

export interface PlannerDoctorItem {
  DoctorID: number;
  Name: string;
  LongName: string;
  ShortName: string;
  Color: string;
}

/**
 * Doctor with FTE traffic-light status.
 * Code: 1006=green (<90%), 1007=orange (90–105%), 1008=red (>105%).
 * Returned by GET /api/traffic-light-calculus and
 * POST /api/doctors-schedule (in rooster-maken context).
 */
export interface TrafficLightDoctor {
  DoctorID: number;
  Name?: string;
  LongName?: string;
  ShortName: string;
  Color?: string;
  FTE_DD_doctor?: number;
  ddhours?: number;
  hours?: number;
  Averagevalue?: number;
  Code: number;
}

/** GET get-planner-schedule response (unified for both Rooster view and RoosterMaken planner) */
export interface PlannerScheduleResponse {
  success: boolean;
  ChipData: RoosterChip[];
  OverWriteChip: OverWriteChipItem[];
  /** Doctors shown as calendar rows (filtered to current user when view=rooster) */
  DoctorData: PlannerDoctorItem[];
  /** All doctors in group (for chip color/name resolution) */
  AllDoctorData?: PlannerDoctorItem[];
  /** Active (aangemeld) doctors shown in planner sidebar */
  ActiveDoctor: PlannerDoctorItem[];
  Vakanties: VakantieItem[];
}

/** GET /api/traffic-light-calculus response */
export interface TrafficLightResponse {
  DoctorData: TrafficLightDoctor[];
}

/** POST /api/doctors-schedule (rooster-maken) response */
export interface PlannerShiftDoctorsResponse {
  success: boolean;
  DoctorData: TrafficLightDoctor[];
  chip_part: string;
}

/** One item in the insert array sent to POST /api/planner-schedule */
export interface PlannerSaveItem {
  doctorid: number;
  current_date: string;
  next_date: string;
  van: number;
  tot: number;
  /** Formatted "DD-MM-YYYY" */
  date: string;
  day: number;
  month: number;
  year: number;
  chip_type: string;
  GroupId: string;
}

/** One item in the delete array sent to POST /api/planner-schedule */
export interface PlannerDeleteItem {
  doctorid: number;
  /** Formatted "DD-MM-YYYY" */
  date: string;
  day: number;
  month: number;
  year: number;
  current_date: string;
  next_date: string;
  van: number;
  tot: number;
  description: string;
  type: string;
  code: string;
  GroupId: string;
}

export interface PlannerSavePayload {
  insert: PlannerSaveItem[];
  delete: PlannerDeleteItem[];
}

export type ChipType = 'Standaard' | 'Achterwacht' | 'Extra';

/** Stripe identity within a shift block: top = Achterwacht, middle = Standaard, bottom = Extra */
export type ShiftBlockSection = 'top' | 'middle' | 'bottom';

/** Pending doctor assignment queued before saving */
export interface PendingAssign {
  chipId: number;
  chip: RoosterChip;
  section: ShiftBlockSection;
  doctorId: number;
  doctorColor: string;
  doctorShortName: string;
}

/** Pending removal of one stripe (chip + section) before saving */
export interface PendingRemoveEntry {
  chip: RoosterChip;
  section: ShiftBlockSection;
}
