'use client';

import Image from 'next/image';
import { absenceDisplayBackground, absenceForegroundIconPath } from './absence-icons';
import type { PraktijkplannerAbsenceType } from '@/types/praktijkplanner';

type AbsenceDaypartCellType = Pick<PraktijkplannerAbsenceType, 'naam' | 'code' | 'kleur' | 'icon'>;

export function AbsenceDaypartCell({
  absence,
  provisional,
  participantInitials,
  fill = false,
}: {
  absence: AbsenceDaypartCellType;
  provisional?: boolean;
  participantInitials?: string;
  fill?: boolean;
}) {
  const background = absenceDisplayBackground(absence.code, absence.kleur, provisional === true);
  const label = `${absence.naam}${provisional ? '?' : ''}`;
  const icon = absenceForegroundIconPath(absence.code, absence.icon, provisional === true);

  return (
    <span
      className={[
        'flex items-center justify-center overflow-hidden rounded',
        fill ? 'absolute inset-0.5' : 'relative block size-10',
      ].join(' ')}
      style={{ background }}
      title={label}
    >
      {icon ? (
        <Image src={icon} alt="" width={28} height={28} className="size-7 object-contain" />
      ) : (
        <span className="px-1 text-center text-[10px] font-bold text-white">{absence.naam.slice(0, 3)}</span>
      )}
      {participantInitials ? (
        <span
          className="absolute -right-0.5 -bottom-0.5 rounded-full px-1 text-[8px] leading-4 font-bold text-white ring-1 ring-white/70"
          style={{ background }}
        >
          {participantInitials}
        </span>
      ) : null}
      <span className="sr-only">{label}</span>
    </span>
  );
}
