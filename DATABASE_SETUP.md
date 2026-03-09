# Database Setup Guide

This project is configured to connect to a PostgreSQL database using the `pg` library.

## Environment Variables

The database connection string is stored in `.env.local` (which is gitignored for security).

### Required Environment Variable

- `DATABASE_URL` - PostgreSQL connection string

Example format:
```
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

## Database Utility

The database connection is managed through `src/lib/db.ts`, which provides:

- **Connection Pooling**: Efficiently manages multiple database connections
- **Query Function**: Execute SQL queries with parameterized queries (prevents SQL injection)
- **Error Handling**: Proper error logging and handling

### Usage Examples

#### In API Routes (Pages Router)

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Simple query
    const result = await query('SELECT * FROM artsen LIMIT 10');
    return res.status(200).json({ data: result.rows });
    
    // Parameterized query (prevents SQL injection)
    const result = await query(
      'SELECT * FROM artsen WHERE id = $1',
      [1]
    );
    return res.status(200).json({ data: result.rows });
  } catch (error) {
    return res.status(500).json({ error: 'Database error' });
  }
}
```

#### Using Transactions

```typescript
import { getClient } from '@/lib/db';

const client = await getClient();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## Example API Route

An example API route is available at `src/pages/api/artsen.ts` that demonstrates:
- Querying the database
- Error handling
- TypeScript types
- Proper API response formatting

Test it by visiting: `http://localhost:3000/api/artsen`

## Security Best Practices

1. **Never commit `.env.local`** - It contains sensitive credentials
2. **Use parameterized queries** - Always use `$1, $2, etc.` instead of string concatenation
3. **Validate input** - Always validate and sanitize user input before database queries
4. **Error messages** - Don't expose database errors to clients in production

## Troubleshooting

### Connection Issues

- Verify `DATABASE_URL` is set correctly in `.env.local`
- Check that the database server is accessible
- Ensure SSL mode matches your database configuration
- Check firewall/network settings

### Pool Exhaustion

If you see "too many clients" errors, adjust the pool settings in `src/lib/db.ts`:
- Reduce `max` connections
- Adjust `idleTimeoutMillis`
- Ensure connections are properly released
