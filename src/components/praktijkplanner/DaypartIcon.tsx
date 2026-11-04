'use client';

import Image from 'next/image';
import { DAYPART_ICONS } from './absence-icons';

/**
 * Het plaatje van een dagdeel: zonsopgang, zonsondergang, maan omlaag, maan omhoog.
 *
 * Stond eerst binnenin de weekweergave. Het staat hier omdat de maandweergave hem ook tekent,
 * en daar draagt hij meer: in de week staat de letter van het dagdeel er nog naast, in de maand
 * is het plaatje het enige wat zegt welk dagdeel een rij is.
 *
 * Args:
 *     maatPx: De maat waarop het plaatje wordt getekend. De week heeft vakjes van 56 pixels en
 *         de maand van 34 tot 72, dus een vaste maat past niet overal.
 */
export function DaypartIcon({
  volgorde,
  className,
  maatPx = 28,
  title,
}: {
  volgorde: number;
  className?: string;
  maatPx?: number;
  title?: string;
}) {
  const icon = DAYPART_ICONS[volgorde];
  if (!icon) return null;
  return (
    <Image
      src={icon}
      alt=""
      title={title}
      width={maatPx}
      height={maatPx}
      className={className ?? 'size-7'}
    />
  );
}
