import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const standaloneDirectory = resolve(root, '.next/standalone');

async function copyDirectory(source, destination) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

try {
  await stat(standaloneDirectory);
  await copyDirectory(resolve(root, 'public'), resolve(standaloneDirectory, 'public'));
  await copyDirectory(
    resolve(root, '.next/static'),
    resolve(standaloneDirectory, '.next/static')
  );
  console.log('Standalone public and static assets prepared.');
} catch (error) {
  console.error('Unable to prepare standalone assets. Run `npm run build` first.', error);
  process.exitCode = 1;
}
