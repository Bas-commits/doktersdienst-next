'use client';

import { useMemo } from 'react';
import { useUrentelling } from '@/hooks/useUrentelling';
import { UrentellingTable } from '@/components/UrentellingTable';

function schoneMaandGrenzen(viewMonth: number, viewYear: number): { vanGte: number; totLte: number } {
  return {
    vanGte: Math.floor(new Date(viewYear, viewMonth, 1, 0, 0, 0, 0).getTime() / 1000),
    totLte: Math.floor(new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999).getTime() / 1000),
  };
}

/**
 * De urentelling naast het rooster, voor dezelfde maand als het rooster laat zien. Kaart:
 * https://trello.com/c/8lHwuHjv/
 *
 * Eigen, schone maandgrenzen in plaats van de vanGte/totLte waarmee rooster-maken-secretaris
 * zelf werkt: die zijn twee weken opgerekt zodat shiftblokken die over de maandgrens heen
 * lopen goed tekenen in de kalender. Voor de urentelling zou dat dagen uit de vorige en
 * volgende maand meetellen in de totalen van de getoonde maand.
 */
export function UrentellingPanel({
  idwaarneemgroep,
  viewMonth,
  viewYear,
  activeGroupName,
  onOpenDeelnemer,
}: {
  idwaarneemgroep: number | null;
  viewMonth: number;
  viewYear: number;
  activeGroupName: string;
  onOpenDeelnemer: (deelnemerId: number) => void;
}) {
  const { vanGte, totLte } = useMemo(
    () => schoneMaandGrenzen(viewMonth, viewYear),
    [viewMonth, viewYear]
  );
  const { columns, rows, details, commitmentPerRow, responseVan, responseTot, loading, error } =
    useUrentelling(idwaarneemgroep, vanGte, totLte);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <h2 className="text-base font-semibold">Urentelling</h2>
      {idwaarneemgroep == null && (
        <p className="text-sm text-muted-foreground">Selecteer eerst een waarneemgroep.</p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Urentelling laden…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && idwaarneemgroep != null && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Geen echte deelnemers gevonden voor deze waarneemgroep.
        </p>
      )}
      {!loading && !error && rows.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <UrentellingTable
            rows={rows}
            columns={columns}
            details={details}
            commitmentPerRow={commitmentPerRow}
            responseVan={responseVan}
            responseTot={responseTot}
            activeGroupName={activeGroupName}
            onOpenDeelnemer={onOpenDeelnemer}
            compact
          />
        </div>
      )}
    </div>
  );
}
