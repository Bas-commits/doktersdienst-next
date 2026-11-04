'use strict';

/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS preload for `node -r` */

/**
 * Preloads root `.env` then `.env.local` (same merge idea as Next) for standalone Node CLIs (`tsx`).
 * Next.js loads these automatically when running the app; `npm run tel-server-sync` does not.
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true, quiet: true });
