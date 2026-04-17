/**
 * Types for Mijn gegevens page and API.
 */

export interface TelnrSlot {
  telnr: string;
  smsontvanger: boolean;
  /** 1001=Mobiel, 1003=Thuis, 1010=Maxer, or a real instellingtype id (1,3,4,8,10,11,12) */
  idInstellingtype: number;
  /** locaties.id — null for Mobiel/Thuis/Maxer (no sub-location) */
  idLocatie: number | null;
  locatieSuffix: 'binnen' | 'buiten';
  /** ref to omschrijvingtelnrs: 1=Spreekkamer, 2=nvt, 3=Sein, 4=Secretariaat, 5=Afsprakenbureau, 6=Portier */
  idomschrtelnr: number;
}

/** Raw slot shape sent to PATCH — maps directly onto the settelnrs columns */
export interface TelnrSlotRaw {
  telnr: string;
  smsontvanger: boolean;
  /** idLocatie ?? idInstellingtype */
  idlocatietelnr: number;
  idomschrtelnr: number;
}

export interface MijnGegevensProfile {
  deelnemer: {
    id: number;
    login: string | null;
    color: string | null;
    achternaam: string | null;
    voorletterstussenvoegsel: string | null;
    voornaam: string | null;
    initialen: string | null;
    geslacht: boolean | null;
    idlocatie: number | null;
    huisadrstraatnr: string | null;
    huisadrpostcode: string | null;
    huisadrplaats: string | null;
    huisadrtelnr: string | null;
    huisadrfax: string | null;
    huisemail: string | null;
    echtedeelnemer: boolean | null;
    smsdienstbegin: boolean | null;
    callRecording: boolean | null;
  };
  waarneemgroep: { id: number; naam: string | null } | null;
  waarneemgroepen: { id: number; naam: string | null; idgroep: number | null; fte: number | null }[];
  groep: { id: number } | null;
  locatie: { id: number; idinstellingtype: number | null; idregio: number | null } | null;
  /** 'binnen' | 'buiten' for location dropdown */
  locatieSuffix: 'binnen' | 'buiten';
  /** Populated phone number slots (only non-empty slots, ordered 1→5) */
  telnrSlots: TelnrSlot[];
}

export interface MijnGegevensLookup {
  instellingtypen: { id: number; naam: string | null }[];
  locatiesPerTypeBinnen: Record<number, { id: number; naam: string }[]>;
  locatiesPerTypeBuiten: Record<number, { id: number; naam: string }[]>;
  omschrijvingtelnrs: { id: number; omschrijving: string }[];
}

/** GET /api/mijn-gegevens response when both profile and lookup are requested in one call */
export interface MijnGegevensPageData {
  profile: MijnGegevensProfile;
  lookup: MijnGegevensLookup;
}

export interface MijnGegevensUpdateBody {
  passa?: string;
  passb?: string;
  color?: string;
  achternaam?: string;
  voorletterstussenvoegsel?: string;
  voornaam?: string;
  initialen?: string;
  geslacht?: 0 | 1 | null;
  idlocatie?: number;
  huisadrstraatnr?: string;
  huisadrpostcode?: string;
  huisadrplaats?: string;
  huisadrtelnr?: string;
  huisadrfax?: string;
  huisemail?: string;
  echtedeelnemer?: boolean;
  smsdienstbegin?: boolean;
  callRecording?: boolean;
  telnrSlots?: TelnrSlotRaw[];
  /** Per waarneemgroep FTE (0–2); only rows where the user is aangemeld are updated */
  waarneemgroepFte?: { idwaarneemgroep: number; fte: number }[];
}
