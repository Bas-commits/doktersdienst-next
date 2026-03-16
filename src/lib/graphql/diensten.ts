/**
 * GraphQL query and subscription for diensten (rooster).
 * Matches Hasura diensten table with where filter on van, tot, idwaarneemgroep.
 */

export const DIENSTEN_QUERY = `
  query QueryDiensten($vanGte: String!, $totLte: String!, $idwaarneemgroepIn: [Int!]) {
    diensten(
      where: {
        van: { _gte: $vanGte }
        tot: { _lte: $totLte }
        idwaarneemgroep: { _in: $idwaarneemgroepIn }
      }
    ) {
      id
      iddeelnemer
      van
      tot
      type
      idwaarneemgroep
      diensten_deelnemers {
        id
        voornaam
        achternaam
        color
      }
    }
  }
`;

export const DIENSTEN_SUBSCRIPTION = `
  subscription QueryDiensten($vanGte: String!, $totLte: String!, $idwaarneemgroepIn: [Int!]) {
    diensten(
      where: {
        van: { _gte: $vanGte }
        tot: { _lte: $totLte }
        idwaarneemgroep: { _in: $idwaarneemgroepIn }
      }
    ) {
      id
      iddeelnemer
      van
      tot
      type
      idwaarneemgroep
      diensten_deelnemers {
        id
        voornaam
        achternaam
        color
      }
    }
  }
`;

export type DienstenSubscriptionVariables = {
  vanGte: string;
  totLte: string;
  idwaarneemgroepIn: number[];
};

/** Raw payload from subscription (van/tot may be number or string from Hasura). */
export type DienstenSubscriptionPayload = {
  diensten: Array<{
    id: number;
    iddeelnemer: number;
    van: number | string;
    tot: number | string;
    type: number;
    idwaarneemgroep: number | null;
    diensten_deelnemers: {
      id: number;
      voornaam: string;
      achternaam: string;
      color: string;
    } | null;
  }>;
};
