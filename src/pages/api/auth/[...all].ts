import { auth } from '@/lib/auth';
import { toNodeHandler } from 'better-auth/node';
import type { NextApiRequest, NextApiResponse } from 'next';

// Disallow body parsing, we will parse it manually
export const config = { api: { bodyParser: false } };

// Convert Better Auth handler to Next.js Pages Router format
export default toNodeHandler(auth.handler);
