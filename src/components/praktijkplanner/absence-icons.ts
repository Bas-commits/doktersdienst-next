import { afwezigheidstypenIconPath } from '@/lib/praktijkplanner/afwezigheidstypen-iconen';

function absenceIcon(filename: string): string {
  return afwezigheidstypenIconPath(filename)!;
}

const ABSENCE_PALETTE_HELP_ICONS: Record<string, string> = {
  vakantie: absenceIcon('holliday-help.svg'),
  nascholing: absenceIcon('education-help.svg'),
  fte: absenceIcon('FTE-help.svg'),
  compensatie: absenceIcon('compensation-help.svg'),
};

export const ABSENCE_PALETTE_ORDER = ['vakantie', 'nascholing', 'fte', 'compensatie'] as const;

export function sortAbsenceTypesForPalette<
  T extends { code: string },
>(types: T[]): T[] {
  return [...types].sort((left, right) => {
    const leftIndex = ABSENCE_PALETTE_ORDER.indexOf(left.code.toLowerCase() as (typeof ABSENCE_PALETTE_ORDER)[number]);
    const rightIndex = ABSENCE_PALETTE_ORDER.indexOf(right.code.toLowerCase() as (typeof ABSENCE_PALETTE_ORDER)[number]);
    return (leftIndex === -1 ? ABSENCE_PALETTE_ORDER.length : leftIndex) -
      (rightIndex === -1 ? ABSENCE_PALETTE_ORDER.length : rightIndex);
  });
}

const ABSENCE_FOREGROUND_ICONS: Record<string, { confirmed: string; provisional: string }> = {
  vakantie: {
    confirmed: absenceIcon('holliday.svg'),
    provisional: absenceIcon('holliday-help.svg'),
  },
  nascholing: {
    confirmed: absenceIcon('education.svg'),
    provisional: absenceIcon('education-help.svg'),
  },
  fte: {
    confirmed: absenceIcon('FTE.svg'),
    provisional: absenceIcon('FTE-help.svg'),
  },
  compensatie: {
    confirmed: absenceIcon('compensation.svg'),
    provisional: absenceIcon('compensation-help.svg'),
  },
};

const ABSENCE_BACKGROUND_ICONS: Record<string, { confirmed: string; provisional: string }> = {
  vakantie: {
    confirmed: '/images/icons/holliday-bg.svg',
    provisional: '/images/icons/holliday-help-bg.svg',
  },
  nascholing: {
    confirmed: '/images/icons/education-bg.svg',
    provisional: '/images/icons/education-help-bg.svg',
  },
  fte: {
    confirmed: '/images/icons/FTE-bg.svg',
    provisional: '/images/icons/FTE-help-bg.svg',
  },
  compensatie: {
    confirmed: '/images/icons/compensation-bg.svg',
    provisional: '/images/icons/compensation-help-bg.svg',
  },
};

export const DAYPART_ICONS: Record<number, string> = {
  1: '/icons/sunrise.svg',
  2: '/icons/sunset.svg',
  3: '/icons/moon-down.svg',
  4: '/icons/moon-up.svg',
};

export function fallbackIconPath(icon: string | null) {
  return afwezigheidstypenIconPath(icon);
}

export function absenceBackgroundIconPath(code: string, icon: string | null, provisional: boolean) {
  const legacyIcon = ABSENCE_BACKGROUND_ICONS[code.toLowerCase()];
  return legacyIcon ? legacyIcon[provisional ? 'provisional' : 'confirmed'] : fallbackIconPath(icon);
}

export function absenceForegroundIconPath(code: string, icon: string | null, provisional: boolean) {
  const legacyIcon = ABSENCE_FOREGROUND_ICONS[code.toLowerCase()];
  return legacyIcon ? legacyIcon[provisional ? 'provisional' : 'confirmed'] : fallbackIconPath(icon);
}

export function absencePaletteIconPath(code: string, icon: string | null, provisional: boolean) {
  const normalizedCode = code.toLowerCase();
  if (provisional) {
    return ABSENCE_PALETTE_HELP_ICONS[normalizedCode] ?? absenceForegroundIconPath(code, icon, true);
  }
  return absenceForegroundIconPath(code, icon, false);
}

const ABSENCE_DISPLAY_BACKGROUNDS: Record<string, { confirmed: string; provisional: string }> = {
  vakantie: {
    confirmed: 'linear-gradient(90deg, #cd1745 0%, #8c0a0a 100%)',
    provisional: 'linear-gradient(90deg, #f63566 0%, #d81d1d 100%)',
  },
  nascholing: {
    confirmed: 'linear-gradient(90deg, #4f1b99 0%, #2d2245 100%)',
    provisional: 'linear-gradient(90deg, #723cbd 0%, #9772e9 100%)',
  },
  fte: {
    confirmed: 'linear-gradient(90deg, #d0bb48 0%, #eeb030 100%)',
    provisional: 'linear-gradient(90deg, #ebd457 0%, #f5b634 100%)',
  },
  compensatie: {
    confirmed: 'linear-gradient(90deg, #c24613 0%, #c46712 100%)',
    provisional: 'linear-gradient(90deg, #db5016 0%, #d8771d 100%)',
  },
};

/**
 * Dezelfde kleur, maar lichter. Zo ziet een aanvraag eruit naast wat al vastligt.
 *
 * Ook gebruikt door het teken van de dienstvoorkeur, zodat aangevraagd en vastgelegd daar op
 * dezelfde manier uit elkaar te houden zijn als bij een afwezigheid.
 */
export function brightenHex(hex: string, amount: number): string {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
  const brightened = channels.map((channel) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount))
  );
  return `#${brightened.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function legacyAbsenceBackground(code: string, provisional: boolean): string | null {
  const legacyBackground = ABSENCE_DISPLAY_BACKGROUNDS[code.toLowerCase()];
  return legacyBackground ? legacyBackground[provisional ? 'provisional' : 'confirmed'] : null;
}

function legacyAbsenceColor(code: string, provisional: boolean): string | null {
  const background = legacyAbsenceBackground(code, provisional);
  if (!background) return null;
  if (background.startsWith('linear-gradient')) {
    const match = background.match(/#[0-9a-fA-F]{3,8}/);
    return match?.[0] ?? null;
  }
  return background;
}

export function absenceDisplayBackground(code: string, kleur: string | null, provisional: boolean): string {
  if (kleur) return provisional ? brightenHex(kleur, 0.18) : kleur;
  return legacyAbsenceBackground(code, provisional) ?? '#64748b';
}

export function absenceDisplayColor(code: string, kleur: string | null, provisional: boolean): string {
  if (kleur) return provisional ? brightenHex(kleur, 0.18) : kleur;
  return legacyAbsenceColor(code, provisional) ?? '#64748b';
}
