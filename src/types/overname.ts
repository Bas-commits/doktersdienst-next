import type { RoosterChip, OverWriteChipItem, VakantieItem } from './rooster';

export type { RoosterChip, OverWriteChipItem, VakantieItem };

/** Doctor in the left sidebar (initial state) and calendar chipArray. */
export interface ActiveDoctorItem {
  DoctorID: number;
  Name: string;
  LongName: string;
  ShortName: string;
  Color: string;
}

/**
 * Doctor returned by POST /api/doctors-schedule.
 * Code maps to a preference icon: 0=minus-circle, 1006=check, 1007=cross,
 * 1008=holiday, 1009=education, 1010=FTE.
 */
export interface DoctorScheduleItem extends ActiveDoctorItem {
  Code: number;
}

export interface TimeDataItem {
  startdate: string;
  starthis: string;
  eniddate: string;
  enidhis: string;
}

/** Preference/availability record from diensten (type 2/3/9/10/5001). */
export interface PreferenceRecord {
  IDdeelnemer: number;
  van: number;
  tot: number;
  type: number;
}

/** GET /api/get-rooster-overname response. */
export interface OvernameResponse {
  success: boolean;
  ChipData: RoosterChip[];
  OverWriteChip: OverWriteChipItem[];
  /** Schedule doctors – used to build chipArray for the calendar. */
  DoctorData: ActiveDoctorItem[];
  /** Active doctors shown in the left sidebar. */
  ActiveDoctor: ActiveDoctorItem[];
  /** Preference records for computing per-slot doctor availability codes. */
  PreferenceRecords: PreferenceRecord[];
  Vakanties: VakantieItem[];
}

/** One shift takeover item sent to POST /api/store-rooster-overname. */
export interface ShiftTakeoverItem {
  ShiftID: number;
  NaarDoctorID: number;
  VanDoctorID: number;
  duty_s_date: string;
  duty_s_time: string;
  duty_e_date: string;
  duty_e_time: string;
  IS_Chip_Haf: boolean;
  GroupId: string;
}

export interface ShiftTakeoverPayload {
  Shift: ShiftTakeoverItem[];
}
