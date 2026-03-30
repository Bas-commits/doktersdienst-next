import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import { auth } from '@/lib/auth';
import { toHeaders } from '@/lib/api-auth';

type Art = {
  id: number;
  naam: string | null;
  voornaam: string | null;
  voorletters: string | null;
  titulatuur: string | null;
  email: string | null;
};

type Data = {
  artsen?: Art[];
  error?: string;
  count?: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await query<Art>(
      'SELECT id, naam, voornaam, voorletters, titulatuur, email FROM artsen LIMIT 10'
    );

    return res.status(200).json({
      artsen: result.rows,
      count: result.rowCount || 0,
    });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
