export const AFWEZIGHEIDSTYPEN_ICONEN_PUBLIC_DIR = '/icons/afwezigheidstypen-iconen';

export function afwezigheidstypenIconPath(filename: string | null | undefined): string | null {
  if (!filename) return null;
  if (filename.startsWith('/') || filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }
  return `${AFWEZIGHEIDSTYPEN_ICONEN_PUBLIC_DIR}/${filename}`;
}
