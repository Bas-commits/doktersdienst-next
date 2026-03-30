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
  /** Overname lifecycle status: 'pending', 'declined', 'accepted', or null/undefined for non-overname records. */
  status?: string | null;
  /** ID of the original dienst being taken over (overname records only). */
  iddienstovern?: number;
  /** ID of the target doctor for the overname (overname records only). */
  iddeelnovern?: number;
  /** ID of the doctor who created the overname proposal. */
  senderId?: number;
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
  /** Optional assigned dienst ID (type=0) backing this block for overname actions. */
  assignedDienstId?: number;
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
  /** Optional: preference type code when block has a saved preference (e.g. "2", "3", "9", "10", "5001"). Used on voorkeuren to show icon + color instead of initials. */
  assignedPreferenceCode?: string;
  /** Optional: overname visual state. Set when this block represents an overname record. */
  overnameType?: 'overname' | 'voorstelOvername' | 'vraagtekenOvername';
}

