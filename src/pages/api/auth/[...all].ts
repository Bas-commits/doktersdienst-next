import { auth } from '@/lib/auth';
import { toNodeHandler } from 'better-auth/node';
import type { NextApiRequest, NextApiResponse } from 'next';

// Disallow body parsing, we will parse it manually
export const config = { api: { bodyParser: false } };

const authHandler = toNodeHandler(auth.handler);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return authHandler(req, res);
}
