import { Pool, QueryResult, QueryResultRow } from 'pg';

// Create a connection pool
// Connection pooling helps manage multiple database connections efficiently
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Optional: Configure pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Execute a SQL query
 * @param text - SQL query string
 * @param params - Query parameters (for parameterized queries)
 * @returns Promise with query result
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error', { text, error });
    throw error;
  }
}

/**
 * Get a single client from the pool for transactions
 * Remember to release the client when done!
 */
export function getClient() {
  return pool.connect();
}

/**
 * Close all database connections
 * Useful for graceful shutdown
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

// Export the pool for advanced usage
export { pool };
