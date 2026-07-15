export const ACTIVITEITEN_ICONEN_PUBLIC_DIR = '/icons/activiteiten-iconen';

export function activiteitenIconPath(filename: string | null | undefined): string | null {
  if (!filename) return null;
  if (filename.startsWith('/') || filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }
  return `${ACTIVITEITEN_ICONEN_PUBLIC_DIR}/${filename}`;
}

export function activiteitenIconLabel(filename: string): string {
  const baseName = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return baseName.charAt(0).toUpperCase() + baseName.slice(1);
}
