export interface DienstDeelnemer {
  id: number;
  voornaam: string;
  achternaam: string;
  color: string;
}

/** Raw dienst item as returned by the database/API. */
export interface Dienst {
  id: number;
  iddeelnemer: number;
  van: number;
  tot: number;
  type: number;
  /** Optional: waarneemgroep id for grouping rows in the calendar. */
  idwaarneemgroep?: number;
  diensten_deelnemers: DienstDeelnemer | null;
}

export interface DienstenResponse {
  data: {
    diensten: Dienst[];
  };
}

export interface DoctorInfo {
  id: number;
  name: string;
  shortName: string;
  color: string;
}

/** Fully resolved block used by CalendarGrid and ShiftBlock. */
export interface ShiftBlockView {
  id: number;
  day: number;
  /** 0-based month (0 = January) */
  month: number;
  year: number;
  /** Unix timestamp in seconds for start of shift. */
  van: number;
  /** Unix timestamp in seconds for end of shift. */
  tot: number;
  /** "HH:MM" local time. */
  startTime: string;
  /** "HH:MM" local time. */
  endTime: string;
  /** "YYYY-MM-DD HH:MM:SS" local datetime. */
  currentDate: string;
  /** "YYYY-MM-DD HH:MM:SS" local datetime. */
  nextDate: string;
  /** Middle stripe (Normaal) doctor, if assigned. */
  middle: DoctorInfo | null;
  /** Top stripe (Achterwacht) doctor, if assigned. */
  top: DoctorInfo | null;
  /** Bottom stripe (Extra Dokter) doctor, if assigned. */
  bottom: DoctorInfo | null;
  /** Optional label for tooltip, e.g. "Ochtend" / "Avond". */
  label?: string;
  /** Optional: waarneemgroep id (for grouping into calendar rows). */
  idwaarneemgroep?: number;
}

