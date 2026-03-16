import { config } from 'dotenv';

// Load .env.local (Next.js local overrides) then .env so drizzle-kit has DATABASE_URL
config({ path: '.env.local' });
config({ path: '.env' });

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './drizzle/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
