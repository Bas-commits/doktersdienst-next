'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';

/**
 * Een icoon met een terugval als het bestand er niet is.
 *
 * De vier vaste afwezigheidstypen hebben een plaatje dat in de repo staat, maar een eigen
 * type krijgt zijn bestandsnaam uit de kolom icon. Staat dat bestand niet in public, dan
 * toont de browser een kapot plaatje: zo stond Dienst graag met icon talk.png in het rooster,
 * want talk.png hoort bij de activiteiten en niet bij de afwezigheidstypen. Een grijs blokje
 * zegt de planner niets, de naam van het type wel.
 */
export function PlannerIconImage({
  src,
  width,
  height,
  className,
  fallback = null,
}: {
  src: string;
  width: number;
  height: number;
  className?: string;
  /** Wat er komt te staan als het bestand niet laadt. Niets tonen mag ook. */
  fallback?: ReactNode;
}) {
  // Op src, niet op een vlag: kiest de planner daarna een type dat wel een plaatje heeft,
  // dan hoort dat gewoon te verschijnen.
  const [mislukt, setMislukt] = useState<string | null>(null);

  if (mislukt === src) return <>{fallback}</>;

  return (
    <Image
      src={src}
      alt=""
      width={width}
      height={height}
      className={className}
      onError={() => setMislukt(src)}
    />
  );
}
