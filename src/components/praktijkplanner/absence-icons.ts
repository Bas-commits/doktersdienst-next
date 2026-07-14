const ABSENCE_PALETTE_HELP_ICONS: Record<string, string> = {
  vakantie: '/icons/holliday-help.svg',
  nascholing: '/icons/education-help.svg',
  fte: '/icons/FTE-help.svg',
  compensatie: '/icons/compensation-help-bg.svg',
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
    confirmed: '/images/icons/holliday.svg',
    provisional: '/images/icons/holliday-help.svg',
  },
  nascholing: {
    confirmed: '/images/icons/education.svg',
    provisional: '/images/icons/education-help.svg',
  },
  fte: {
    confirmed: '/images/icons/FTE.svg',
    provisional: '/images/icons/FTE-help.svg',
  },
  compensatie: {
    confirmed: '/images/icons/compensation.svg',
    provisional: '/images/icons/compensation-help.svg',
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
  if (!icon) return null;
  if (icon.startsWith('/') || icon.startsWith('http://') || icon.startsWith('https://')) return icon;
  return `/images/icons/${icon}`;
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

export function absenceDisplayBackground(code: string, kleur: string | null, provisional: boolean): string {
  const legacyBackground = ABSENCE_DISPLAY_BACKGROUNDS[code.toLowerCase()];
  if (legacyBackground) return legacyBackground[provisional ? 'provisional' : 'confirmed'];
  return kleur || '#64748b';
}

export function absenceDisplayColor(code: string, kleur: string | null, provisional: boolean): string {
  const background = absenceDisplayBackground(code, kleur, provisional);
  if (background.startsWith('linear-gradient')) {
    const match = background.match(/#[0-9a-fA-F]{3,8}/);
    return match?.[0] ?? kleur ?? '#64748b';
  }
  return background;
}
