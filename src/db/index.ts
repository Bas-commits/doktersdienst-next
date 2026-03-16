import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from '@/lib/db';
import * as schema from '../../drizzle/schema';
import * as relations from '../../drizzle/relations';

/**
 * Drizzle ORM client wired to your existing pg pool and introspected schema.
 * Use in Server Components, API routes, and Server Actions.
 *
 * @example
 * import { db, schema } from '@/db';
 * const rows = await db.select().from(schema.ritten);
 */
export const db = drizzle({ client: pool, schema: { ...schema, ...relations } });
export { schema };
