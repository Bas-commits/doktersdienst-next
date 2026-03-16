/**
 * Types for Mijn gegevens page and API.
 */

export interface MijnGegevensProfile {
  deelnemer: {
    id: number;
    login: string | null;
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
  };
  waarneemgroep: { id: number; naam: string | null } | null;
  groep: { id: number } | null;
  locatie: { id: number; idinstellingtype: number | null; idregio: number | null } | null;
  /** 'binnen' | 'buiten' for location dropdown */
  locatieSuffix: 'binnen' | 'buiten';
}

export interface MijnGegevensLookup {
  instellingtypen: { id: number; naam: string | null }[];
  locatiesPerTypeBinnen: Record<number, { id: number; naam: string }[]>;
  locatiesPerTypeBuiten: Record<number, { id: number; naam: string }[]>;
}

/** GET /api/mijn-gegevens response when both profile and lookup are requested in one call */
export interface MijnGegevensPageData {
  profile: MijnGegevensProfile;
  lookup: MijnGegevensLookup;
}

export interface MijnGegevensUpdateBody {
  login?: string;
  passa?: string;
  passb?: string;
  achternaam?: string;
  voorletterstussenvoegsel?: string;
  voornaam?: string;
  initialen?: string;
  geslacht?: 0 | 1;
  idlocatie?: number;
  huisadrstraatnr?: string;
  huisadrpostcode?: string;
  huisadrplaats?: string;
  huisadrtelnr?: string;
  huisadrfax?: string;
  huisemail?: string;
  echtedeelnemer?: boolean;
  smsdienstbegin?: boolean;
}
