export type IsoDate = `${number}-${number}-${number}`;

export type PraktijkplannerParticipantExpertise = {
  id: number;
  naam: string;
  afkorting: string | null;
};

export type PraktijkplannerParticipant = {
  id: number;
  voornaam: string | null;
  voorletterstussenvoegsel: string | null;
  achternaam: string | null;
  initialen: string | null;
  color: string | null;
  name: string | null;
  /** Expertises assigned to this deelnemer for the current waarneemgroep. */
  expertises?: PraktijkplannerParticipantExpertise[];
};

export type PraktijkplannerDaypart = {
  id: number;
  naam: string;
  volgorde: number;
};

export type PraktijkplannerExpertise = {
  id: number;
  naam: string;
  afkorting: string | null;
  actief: boolean;
};

export type PraktijkplannerActivity = {
  id: number;
  naam: string;
  afkorting: string | null;
  kleur: string | null;
  icon: string | null;
  idexpertise: number | null;
  actief: boolean;
};

export type PraktijkplannerActivitySpecification = {
  id: number;
  idactiviteit: number;
  naam: string;
  afkorting: string | null;
  kleur: string | null;
  actief: boolean;
};

/**
 * Wat een arts over diensten heeft gezegd voor een dagdeel.
 *
 * Bewust geen afwezigheid: bij "graag" is de arts er juist wel. Daarom een eigen tabel, zodat
 * de jaarbalans er niets van meetelt.
 */
export type PraktijkplannerDienstvoorkeurWaarde = 'graag' | 'liever_niet';

export type PraktijkplannerDienstvoorkeur = {
  id: number;
  iddeelnemer: number;
  datum: string;
  iddagdeel: number;
  voorkeur: PraktijkplannerDienstvoorkeurWaarde;
};

export type PraktijkplannerTaskType = {
  id: number;
  afkorting: string | null;
  omschrijving: string | null;
  kleur: string | null;
  idexpertise: number | null;
  /** Mag op elke locatie gebeuren; de eis geldt dan voor de hele waarneemgroep. */
  nietLocatieGebonden: boolean;
  /** Collega's kunnen deze taak bellen; het rooster zet er een telefoonicoontje bij. */
  inbelbaar: boolean;
  /**
   * Deze taak is een dienst. Mag daarom wel op een dagdeel waarop de arts niet werkt, en
   * wordt met rust gelaten door herhalen, kopieren en Leegmaken.
   */
  isDienst: boolean;
  actief: boolean;
};

export type PraktijkplannerLocation = {
  id: number;
  naam: string;
  afkorting: string | null;
  kleur: string | null;
  actief: boolean;
  idlocatie: number | null;
};

export type PraktijkplannerAvailabilityType = {
  id: number;
  naam: string;
  code: string;
  kleur: string | null;
  icon: string | null;
  type: string;
  actief: boolean;
};

export type PraktijkplannerAbsenceType = {
  id: number;
  naam: string;
  code: string;
  kleur: string | null;
  icon: string | null;
  actief: boolean;
};

/** Per-group weekday (1=Mon…7=Sun) × daypart schedulability. Empty = all schedulable. */
export type PraktijkplannerSchedulableDaypart = {
  weekdag: number;
  iddagdeel: number;
  actief: boolean;
};

/** Per-deelnemer override. Empty for a deelnemer = inherit group matrix. */
export type PraktijkplannerParticipantSchedulableDaypart = PraktijkplannerSchedulableDaypart & {
  iddeelnemer: number;
};

export type PraktijkplannerMasterData = {
  dayparts: PraktijkplannerDaypart[];
  expertises: PraktijkplannerExpertise[];
  activities: PraktijkplannerActivity[];
  specifications: PraktijkplannerActivitySpecification[];
  tasks: PraktijkplannerTaskType[];
  locations: PraktijkplannerLocation[];
  availabilityTypes: PraktijkplannerAvailabilityType[];
  absenceTypes: PraktijkplannerAbsenceType[];
  schedulableDayparts: PraktijkplannerSchedulableDaypart[];
  participantSchedulableDayparts: PraktijkplannerParticipantSchedulableDaypart[];
};

export type PraktijkplannerTask = {
  id: number;
  positie: number;
  afkorting: string | null;
  omschrijving: string | null;
  kleur: string | null;
  /** Staat op het taaktype, niet op deze planning. Zie PraktijkplannerTaskType. */
  inbelbaar: boolean;
};

export type PraktijkplannerPlanningSlot = {
  id: number;
  iddeelnemer: number;
  datum: string;
  iddagdeel: number;
  idactiviteit: number | null;
  idactiviteitspecificatie: number | null;
  idplannerlocatie: number | null;
  version: number;
  activity: Pick<PraktijkplannerActivity, 'id' | 'naam' | 'afkorting' | 'kleur' | 'icon'> | null;
  specification: Pick<PraktijkplannerActivitySpecification, 'id' | 'naam' | 'afkorting' | 'kleur'> | null;
  location: Pick<PraktijkplannerLocation, 'id' | 'naam' | 'afkorting' | 'kleur'> | null;
  tasks: PraktijkplannerTask[];
  availability: Pick<PraktijkplannerAvailabilityType, 'id' | 'naam' | 'code' | 'kleur' | 'icon'> | null;
  recurrenceId: number | null;
  isBronslot: boolean | null;
  isUitzondering: boolean | null;
  /**
   * Monday of the week this slot's recurrence was copied from. Null for series created
   * before the source week was recorded; the warning then names no week rather than a
   * guessed one.
   */
  recurrenceSourceWeek: string | null;
};

export type PraktijkplannerAbsenceSlot = {
  id: number;
  iddeelnemer: number;
  datum: string;
  iddagdeel: number;
  idafwezigheidstype: number;
  isVoorlopig: boolean;
  version: number;
  absenceType: Pick<PraktijkplannerAbsenceType, 'id' | 'naam' | 'code' | 'kleur' | 'icon'>;
};

export type PraktijkplannerYearBalanceMutation = {
  datum: string;
  dagdeel: string;
};

export type PraktijkplannerYearBalance = {
  absenceType: PraktijkplannerAbsenceType;
  beginsaldo: number;
  budget: number;
  mutaties: number;
  mutatiesVoorlopig: number;
  mutatieDatums: PraktijkplannerYearBalanceMutation[];
  mutatieDatumsVoorlopig: PraktijkplannerYearBalanceMutation[];
  totaal: number;
  totaalVoorlopig: number;
};

export type PraktijkplannerCapacityRequirement = {
  id: number;
  aantal: number;
};

export type PraktijkplannerCapacityCell = {
  id: number | null;
  weekdag: number;
  iddagdeel: number;
  aantalDeelnemers: number;
  expertises: PraktijkplannerCapacityRequirement[];
  tasks: PraktijkplannerCapacityRequirement[];
  activities: PraktijkplannerCapacityRequirement[];
  specifications: PraktijkplannerCapacityRequirement[];
};

/**
 * Een benoemde afwijking op de normale week, met de maandagen van de weken waarin hij geldt.
 *
 * Een regime vervangt de normale week, het vult hem niet aan: wat in het regime staat is wat
 * geldt. Weken staan als maandag en niet als jaar plus weeknummer, want een week over de
 * jaargrens hoort bij twee jaartallen.
 */
export type PraktijkplannerCapacityRegime = {
  id: number;
  naam: string;
  weken: string[];
};

export type PraktijkplannerCapacityComparison = {
  key: string;
  label: string;
  gepland: number;
  benodigd: number;
  status: 'groen' | 'oranje' | 'rood';
};
