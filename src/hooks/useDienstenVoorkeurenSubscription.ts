'use client';

import { gql } from '@apollo/client';
import { useSubscription } from '@apollo/client/react';
import { useMemo } from 'react';
import type { DienstenResponse, Dienst } from '@/types/diensten';
import type { DienstenVoorkeurenSubscriptionVariables } from '@/lib/graphql/diensten';

const VOORKEUREN_SUBSCRIPTION_DOC = gql`
  subscription QueryDienstenVoorkeuren(
    $vanGte: bigint!
    $totLte: bigint!
    $idwaarneemgroepIn: [Int!]!
    $typeIn: [Int!]!
    $idDeelnemer: Int!
  ) {
    diensten(
      where: {
        van: { _gte: $vanGte }
        tot: { _lte: $totLte }
        idwaarneemgroep: { _in: $idwaarneemgroepIn }
        type: { _in: $typeIn }
        diensten_deelnemers: { id: { _eq: $idDeelnemer } }
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

export type UseDienstenVoorkeurenSubscriptionResult = {
  data: DienstenResponse | null;
  error: string | null;
  loading: boolean;
};

/** Subscription payload has van/tot as number or string; normalize to number. */
function toDienstenResponse(payload: { diensten?: Array<{
  id: number;
  iddeelnemer?: number;
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
}> } | null | undefined): DienstenResponse | null {
  if (!payload?.diensten?.length) return { data: { diensten: [] } };
  const list: Dienst[] = payload.diensten.map((d) => ({
    id: d.id,
    iddeelnemer: d.iddeelnemer ?? 0,
    van: typeof d.van === 'string' ? parseInt(d.van, 10) : d.van,
    tot: typeof d.tot === 'string' ? parseInt(d.tot, 10) : d.tot,
    type: d.type,
    idwaarneemgroep: d.idwaarneemgroep ?? undefined,
    diensten_deelnemers: d.diensten_deelnemers
      ? {
          id: d.diensten_deelnemers.id,
          voornaam: d.diensten_deelnemers.voornaam ?? '',
          achternaam: d.diensten_deelnemers.achternaam ?? '',
          color: d.diensten_deelnemers.color ?? '',
        }
      : null,
  }));
  return { data: { diensten: list } };
}

/** Types for voorkeuren page: diensten where the current user is participant (e.g. 3, 2, 9, 10, 5001). */
export const VOORKEUREN_DIENST_TYPES = [3, 2, 9, 10, 5001] as const;

/**
 * Subscribes to diensten for the voorkeuren page: date range, waarneemgroep(s), type filter,
 * and participant filter (diensten_deelnemers.id = idDeelnemer).
 * Must be used inside HasuraApolloProvider. When idDeelnemer is missing or idwaarneemgroepen
 * empty, no subscription is run and empty data is returned.
 */
export function useDienstenVoorkeurenSubscription(
  vanGte: number,
  totLte: number,
  idwaarneemgroepen: number[],
  idDeelnemer: number | null | undefined,
  typeIn: number[] = [...VOORKEUREN_DIENST_TYPES]
): UseDienstenVoorkeurenSubscriptionResult {
  const variables = useMemo((): DienstenVoorkeurenSubscriptionVariables | null => {
    const id = idDeelnemer != null && idDeelnemer > 0 ? idDeelnemer : null;
    if (id == null || idwaarneemgroepen.length === 0) return null;
    const vars = {
      vanGte,
      totLte,
      idwaarneemgroepIn: idwaarneemgroepen,
      typeIn: typeIn.length > 0 ? typeIn : [...VOORKEUREN_DIENST_TYPES],
      idDeelnemer: id,
    };
    // #region agent log
    fetch('http://127.0.0.1:7253/ingest/a82f229b-2fdf-4ed8-b109-9a2c6d129ff7', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useDienstenVoorkeurenSubscription.ts:variables', message: 'Subscription variables', data: { vanGteType: typeof vars.vanGte, totLteType: typeof vars.totLte, vanGte: vars.vanGte, totLte: vars.totLte }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {});
    // #endregion
    return vars;
  }, [vanGte, totLte, idwaarneemgroepen, idDeelnemer, typeIn]);

  const { data: rawData, loading, error } = useSubscription<{ diensten: unknown[] }>(VOORKEUREN_SUBSCRIPTION_DOC, {
    variables: variables ?? undefined,
    skip: variables == null,
  });

  const data = useMemo(() => toDienstenResponse(rawData ?? null), [rawData]);
  const errorMessage = error?.message ?? null;

  return {
    data: variables == null ? null : data,
    error: errorMessage,
    loading: variables != null && loading,
  };
}
