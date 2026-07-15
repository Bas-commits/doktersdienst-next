import fs from 'fs';
import path from 'path';

const ICON_DIR = path.join(process.cwd(), 'public/icons/activiteiten-iconen');
const ALLOWED_EXTENSIONS = new Set(['.png', '.svg', '.jpg', '.jpeg', '.webp', '.gif']);

export function listActiviteitenIconen(): string[] {
  if (!fs.existsSync(ICON_DIR)) return [];

  return fs
    .readdirSync(ICON_DIR)
    .filter((filename) => ALLOWED_EXTENSIONS.has(path.extname(filename).toLowerCase()))
    .sort((left, right) => left.localeCompare(right, 'nl'));
}
