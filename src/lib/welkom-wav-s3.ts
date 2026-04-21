import {
  CopyObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const DEFAULT_REGION = 'eu-west-1';
const SOUNDS_PREFIX = 'sounds';

export class WelkomWavValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WelkomWavValidationError';
  }
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? DEFAULT_REGION;
    const endpoint =
      process.env.S3_ENDPOINT_URL?.trim() ||
      process.env.AWS_S3_ENDPOINT?.trim() ||
      process.env.AWS_ENDPOINT_URL?.trim() ||
      undefined;

    s3Client = new S3Client({
      region,
      ...(endpoint
        ? {
            endpoint,
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
          }
        : {}),
    });
  }
  return s3Client;
}

/** Local wall-clock time, filesystem-safe: 2026-04-20-14-30-45-123 */
export function welkomBackupTimestampLabel(d = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-` +
    `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`
  );
}

/** Strip path / extension; safe ASCII-ish basename for S3 keys. */
export function sanitizeWelkomFileBase(filename: string): string {
  const leaf = filename.replace(/^.*[/\\]/, '').trim();
  const base = leaf.replace(/\.[^.\\/]+$/i, '');
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .replace(/^_|_$/g, '');
  const truncated = cleaned.slice(0, 120);
  return truncated || 'welkom';
}

/** New object key: sounds/{basename}_{human-timestamp}.sln */
export function buildNewWelkomSlnObjectKey(originalFilename: string): string {
  const base = sanitizeWelkomFileBase(originalFilename);
  return `${SOUNDS_PREFIX}/${base}_${welkomBackupTimestampLabel()}.sln`;
}

/** Backup copy of an existing .sln key before replace. */
export function welkomBackupKeyFromSourceKey(sourceKey: string, timestampLabel: string): string {
  return sourceKey.replace(/\.sln$/i, '') + `.old-${timestampLabel}.sln`;
}

function s3CopySource(bucket: string, key: string): string {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number }; Code?: string };
  return (
    e.name === 'NotFound' ||
    e.Code === 'NoSuchKey' ||
    e.$metadata?.httpStatusCode === 404
  );
}

async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await getS3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err: unknown) {
    if (isNotFound(err)) return false;
    throw err;
  }
}

/** Legacy fixed keys (migration) — try Head after DB loc. */
export function welkomWelkomstLegacyHeadKeys(idwaarneemgroep: number): string[] {
  return [
    `${SOUNDS_PREFIX}/welkom-wg-${idwaarneemgroep}_gsm.sln`,
    `${SOUNDS_PREFIX}/welkom-wg-${idwaarneemgroep}_gsm.gsm`,
    `${SOUNDS_PREFIX}/welkom-wg-${idwaarneemgroep}_gsm.wav`,
  ];
}

/**
 * Bucket for welkom audio. Primary: S3_WELKOM_BUCKET.
 */
export function getWelkomWavBucket(): string | null {
  const candidates = [
    process.env.S3_WELKOM_BUCKET,
    process.env.AWS_S3_WELKOM_BUCKET,
    process.env.S3_SOUNDS_BUCKET,
    process.env.AWS_S3_SOUNDS_BUCKET,
  ];
  for (const c of candidates) {
    const b = c?.trim();
    if (b) return b;
  }
  return null;
}

export function isLikelyWavBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  return buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WAVE';
}

export type ExtractSlnResult = { ok: true; sln: Buffer } | { ok: false; message: string };

const SLN_SAMPLE_RATE = 8000;
const MIN_INPUT_RATE = 4000;
const MAX_INPUT_RATE = 96000;

function decodeWavPcmToMonoFloat(
  wav: Buffer,
  dataOffset: number,
  dataSize: number,
  numChannels: number,
  bitsPerSample: number
): Float64Array | null {
  if (numChannels < 1 || numChannels > 2) return null;
  if (bitsPerSample !== 8 && bitsPerSample !== 16) return null;

  const bytesPerSample = bitsPerSample / 8;
  const frameSize = bytesPerSample * numChannels;
  if (frameSize < 1) return null;

  const numFrames = Math.floor(dataSize / frameSize);
  if (numFrames === 0) return null;

  const end = Math.min(dataOffset + numFrames * frameSize, wav.length);
  const out = new Float64Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const pos = dataOffset + f * frameSize + ch * bytesPerSample;
      if (pos + bytesPerSample > end) return null;
      if (bitsPerSample === 8) {
        sum += (wav[pos]! - 128) / 128;
      } else {
        sum += wav.readInt16LE(pos) / 32768;
      }
    }
    out[f] = sum / numChannels;
  }
  return out;
}

function floatMonoToSlnBuffer(samples: Float64Array, fromRate: number): Buffer {
  if (fromRate <= 0 || !Number.isFinite(fromRate)) return Buffer.alloc(0);

  if (fromRate === SLN_SAMPLE_RATE) {
    const buf = Buffer.alloc(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]!));
      buf.writeInt16LE(Math.round(s * 32767), i * 2);
    }
    return buf;
  }

  const outLen = Math.max(1, Math.floor((samples.length * SLN_SAMPLE_RATE) / fromRate));
  const buf = Buffer.alloc(outLen * 2);
  for (let i = 0; i < outLen; i++) {
    const srcPos = (i * fromRate) / SLN_SAMPLE_RATE;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = srcPos - i0;
    const s = samples[i0]! * (1 - frac) + samples[i1]! * frac;
    const clamped = Math.max(-1, Math.min(1, s));
    buf.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }
  return buf;
}

export function extractSlnFromTelephonyWav(wav: Buffer): ExtractSlnResult {
  if (wav.length < 12 || !isLikelyWavBuffer(wav)) {
    return { ok: false, message: 'Geen geldig WAV-bestand.' };
  }

  let offset = 12;
  let fmt: Buffer | null = null;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= wav.length) {
    const chunkId = wav.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = wav.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const paddedSize = chunkSize + (chunkSize % 2);

    if (chunkId === 'fmt ') {
      fmt = wav.subarray(chunkDataStart, chunkDataStart + chunkSize);
    } else if (chunkId === 'data') {
      dataOffset = chunkDataStart;
      dataSize = chunkSize;
      break;
    }

    offset = chunkDataStart + paddedSize;
  }

  if (!fmt || fmt.length < 16 || dataOffset < 0) {
    return { ok: false, message: 'WAV mist een geldige fmt- of data-chunk.' };
  }

  const audioFormat = fmt.readUInt16LE(0);
  const numChannels = fmt.readUInt16LE(2);
  const sampleRate = fmt.readUInt32LE(4);
  const bitsPerSample = fmt.readUInt16LE(14);

  if (audioFormat !== 1) {
    return {
      ok: false,
      message: 'WAV moet ongecomprimeerd PCM zijn (geen gecomprimeerde codecs in het bestand).',
    };
  }
  if (numChannels < 1 || numChannels > 2) {
    return { ok: false, message: 'WAV moet mono of stereo zijn (max. 2 kanalen).' };
  }
  if (bitsPerSample !== 8 && bitsPerSample !== 16) {
    return { ok: false, message: 'WAV moet 8- of 16-bit PCM zijn.' };
  }
  if (sampleRate < MIN_INPUT_RATE || sampleRate > MAX_INPUT_RATE) {
    return {
      ok: false,
      message: `Samplefrequentie moet tussen ${MIN_INPUT_RATE} en ${MAX_INPUT_RATE} Hz zijn.`,
    };
  }

  const usableDataSize = Math.min(dataSize, wav.length - dataOffset);
  const mono = decodeWavPcmToMonoFloat(wav, dataOffset, usableDataSize, numChannels, bitsPerSample);
  if (!mono || mono.length === 0) {
    return { ok: false, message: 'WAV bevat geen bruikbare audio.' };
  }

  const sln = floatMonoToSlnBuffer(mono, sampleRate);
  if (sln.length === 0) {
    return { ok: false, message: 'Kon audio niet omzetten naar telefonieformaat.' };
  }

  return { ok: true, sln };
}

export async function welkomWelkomstFilePresent(
  idwaarneemgroep: number,
  eigentelwelkomlocatie: string | null | undefined
): Promise<boolean> {
  const bucket = getWelkomWavBucket();
  if (!bucket) return false;

  const keys: string[] = [];
  const loc = eigentelwelkomlocatie?.trim();
  if (loc) keys.push(loc);
  keys.push(...welkomWelkomstLegacyHeadKeys(idwaarneemgroep));

  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    if (await objectExists(bucket, key)) return true;
  }
  return false;
}

export async function copyWelkomSlnToBackupIfExists(bucket: string, sourceKey: string): Promise<void> {
  if (!(await objectExists(bucket, sourceKey))) return;
  const backupKey = welkomBackupKeyFromSourceKey(sourceKey, welkomBackupTimestampLabel());
  await getS3Client().send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: backupKey,
      CopySource: s3CopySource(bucket, sourceKey),
      MetadataDirective: 'COPY',
    })
  );
}

export async function putWelkomSlnAtKey(wavBody: Buffer, objectKey: string): Promise<void> {
  const bucket = getWelkomWavBucket();
  if (!bucket) {
    throw new Error('S3_WELKOM_BUCKET is not configured');
  }

  const sln = extractSlnFromTelephonyWav(wavBody);
  if (!sln.ok) {
    throw new WelkomWavValidationError(sln.message);
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: sln.sln,
      ContentType: 'application/octet-stream',
    })
  );
}
