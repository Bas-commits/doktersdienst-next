/**
 * Returns black or white text for best contrast on a 6-digit hex background,
 * using weighted luminance (0.299·R + 0.587·G + 0.114·B on linearized 0–1 channels).
 */
export function getContrastTextColor(hex: string): '#000000' | '#ffffff' {
  const normalized = hex.trim();
  const match = /^#?([0-9a-fA-F]{6})$/.exec(normalized);
  if (!match) {
    return '#ffffff';
  }
  const h = match[1]!;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.8 ? '#000000' : '#ffffff';
}
