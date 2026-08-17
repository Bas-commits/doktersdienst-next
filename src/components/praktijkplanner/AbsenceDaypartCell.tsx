'use client';

import { absenceDisplayBackground, absenceForegroundIconPath } from './absence-icons';
import { PlannerIconImage } from './PlannerIconImage';
import { cn } from '@/lib/utils';
import type { PraktijkplannerAbsenceType } from '@/types/praktijkplanner';

type AbsenceDaypartCellType = Pick<PraktijkplannerAbsenceType, 'naam' | 'code' | 'kleur' | 'icon'>;

export function AbsenceDaypartCell({
  absence,
  provisional,
  participantInitials,
  participantColor,
  fill = false,
}: {
  absence: AbsenceDaypartCellType;
  provisional?: boolean;
  participantInitials?: string;
  /** Kleur van het kadertje. Zonder deelnemer valt hij terug op hetzelfde grijs als een fiche. */
  participantColor?: string | null;
  fill?: boolean;
}) {
  const background = absenceDisplayBackground(absence.code, absence.kleur, provisional === true);
  const label = `${absence.naam}${provisional ? '?' : ''}`;
  const icon = absenceForegroundIconPath(absence.code, absence.icon, provisional === true);
  // Ook de terugval als het icoonbestand er wel is volgens de database maar niet in public.
  const naamKort = (
    <span className="px-1 text-center text-[10px] font-bold text-white">{absence.naam.slice(0, 3)}</span>
  );

  // Hetzelfde kadertje als een fiche: gekleurde opvulling rondom een dichtgeknipt vlak, geen
  // CSS-border. Zo kan er tussen kader en vlak nooit een witte haarlijn opduiken, en leest een
  // afwezigheid als net zo'n vakje als PV of CVDV.
  const heeftDeelnemerKader = Boolean(participantColor);
  const kaderKleur = participantColor || '#c4c4c4';

  return (
    <span
      className={fill ? 'absolute inset-0.5 block' : 'relative block size-10'}
      title={label}
    >
      <span
        className={cn('absolute inset-0 rounded-md', heeftDeelnemerKader ? 'p-[3px]' : 'p-px')}
        style={{ backgroundColor: kaderKleur }}
        data-planner-afwezigheid-kader=""
      >
        <span
          className={cn(
            'flex h-full w-full items-center justify-center overflow-hidden',
            // Houdt de ronding gelijkmatig: buitenradius min de opvulling.
            heeftDeelnemerKader ? 'rounded-[3px]' : 'rounded-[5px]'
          )}
          style={{ background }}
        >
          {/*
            Het vakje is in de week 56 pixels en in de maand 34. Zonder de bovengrens loopt het
            icoon in de maand over zijn eigen kader heen; met alleen een percentage wordt hij in
            de week juist groter dan hij ooit was.
          */}
          {icon ? (
            <PlannerIconImage
              src={icon}
              width={28}
              height={28}
              className="size-7 max-h-full max-w-full object-contain"
              fallback={naamKort}
            />
          ) : (
            naamKort
          )}
        </span>
      </span>
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
