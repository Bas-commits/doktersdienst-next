/**
 * Types for the get-rooster-shift API and calendar UI.
 * Aligned with backend ShiftController::getRoosterShift and rooster-calendar.js.
 */

export interface RoosterChip {
  id: number;
  date: string;
  day: string | number;
  month: string | number;
  year: string | number;
  type: number;
  van: number;
  tot: number;
  startchip: string;
  chipboxwidth: string;
  IDdeelnemer: number;
  IDwaarneemgroep?: number;
  /** When set, this chip is an assignment; delete/recurrence use this type-1 shift ID. */
  IDshift?: number | null;
  IDdienstherhalen?: number | null;
  IDaantekening?: string | number | null;
  IDdeelnovern?: number | null;
  IDdienstovern?: number | null;
  current_date: string;
  next_date: string;
  Achterw_doctor: number;
  Extra_doctor: number;
  chip_part: string;
  start_time: string;
  end_time: string;
  /** Present on overwrite split chips */
  match?: boolean;
}

export interface ChipArrayItem {
  Id: number;
  Name: string;
  ShortName: string;
  Color: string;
}

export interface DoctorDataRow {
  DoctorID: number;
  Name: string;
  Color: string;
  ShortName?: string;
  LongName?: string;
  Email?: string;
}

export interface AllDoctorDataItem {
  DoctorID: number;
  Name: string;
  LongName: string;
  ShortName: string;
  Color: string;
  Email?: string;
}

export interface OverWriteChipItem {
  van: number;
  tot: number;
  IDdeelnemer: number;
  IDdeelnovern?: number;
  IDdienstovern?: number;
  [key: string]: unknown;
}

export interface VakantieItem {
  current_date: string;
  next_date: string;
  naam: string;
}

export interface RoosterShiftResponse {
  success: boolean;
  ChipData: RoosterChip[];
  DoctorData: DoctorDataRow[];
  AllDoctorData: AllDoctorDataItem[];
  OverWriteChip: OverWriteChipItem[];
  Vakanties: VakantieItem[];
}

export interface CalandarShiftData {
  shiftData: any[];
  doctorData: any[];
  vakanties: VakantieItem[];
}

export interface WeekDateRangeItem {
  Date: string;
  DateDDMMYYYY: string;
  Day: number;
  Month: number;
  Year: number;
}
