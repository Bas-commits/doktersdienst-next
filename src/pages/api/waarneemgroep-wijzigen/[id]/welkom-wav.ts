import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAuthenticatedUser, hasGroupManagementAccess } from '@/lib/api-auth';
import {
  buildNewWelkomSlnObjectKey,
  copyWelkomSlnToBackupIfExists,
  getWelkomWavBucket,
  isLikelyWavBuffer,
  putWelkomSlnAtKey,
  WelkomWavValidationError,
} from '@/lib/welkom-wav-s3';

const { waarneemgroepen } = schema;

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_WAV_BYTES = 15 * 1024 * 1024;

function readBody(req: NextApiRequest, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('payload-too-large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseWelkomFilenameHeader(req: NextApiRequest): string {
  const raw = req.headers['x-welkom-filename'];
  if (typeof raw !== 'string' || !raw.trim()) return 'welkom.wav';
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return 'welkom.wav';
  }
}

/**
 * POST /api/waarneemgroep-wijzigen/:id/welkom-wav
 * Body: raw WAV. Header X-Welkom-Filename: encodeURIComponent(original name).
 * Stores SLN at sounds/{basename}_{timestamp}.sln and sets eigentelwelkomlocatie.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true; eigentelwelkomlocatie: string } | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bucket = getWelkomWavBucket();
  if (!bucket) {
    return res.status(503).json({
      error:
        'Welkomst-audio opslag is niet geconfigureerd. Zet S3_WELKOM_BUCKET (of S3_SOUNDS_BUCKET) op de bucketnaam in .env / .env.local en herstart de server.',
    });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = Number(req.query.id);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const hasAccess = await hasGroupManagementAccess(user, id);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Geen toegang tot deze waarneemgroep.' });
  }

  const ct = (req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (ct !== 'audio/wav' && ct !== 'audio/x-wav') {
    return res.status(400).json({ error: 'Alleen WAV-upload is toegestaan (Content-Type audio/wav).' });
  }

  let buf: Buffer;
  try {
    buf = await readBody(req, MAX_WAV_BYTES);
  } catch (e) {
    if (e instanceof Error && e.message === 'payload-too-large') {
      return res.status(413).json({ error: 'Bestand is te groot (max. 15 MB).' });
    }
    throw e;
  }

  if (buf.length === 0) {
    return res.status(400).json({ error: 'Leeg bestand.' });
  }

  if (!isLikelyWavBuffer(buf)) {
    return res.status(400).json({ error: 'Bestand is geen geldige WAV.' });
  }

  try {
    const [row] = await db
      .select({ loc: waarneemgroepen.eigentelwelkomlocatie })
      .from(waarneemgroepen)
      .where(eq(waarneemgroepen.id, id))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: 'Waarneemgroep niet gevonden' });
    }

    const prev = row.loc?.trim() ?? null;
    if (prev) {
      await copyWelkomSlnToBackupIfExists(bucket, prev);
    }

    const objectKey = buildNewWelkomSlnObjectKey(parseWelkomFilenameHeader(req));
    await putWelkomSlnAtKey(buf, objectKey);

    await db
      .update(waarneemgroepen)
      .set({ eigentelwelkomlocatie: objectKey })
      .where(eq(waarneemgroepen.id, id));

    return res.status(200).json({ ok: true, eigentelwelkomlocatie: objectKey });
  } catch (err) {
    if (err instanceof WelkomWavValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('POST welkom-wav S3 error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Upload mislukt' });
  }
}
