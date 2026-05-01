import http from 'node:http';
import type { SmsConfig, TelSyncTarget } from './config';

type FormData = Record<string, string | number | boolean | null | undefined>;

export function encodeFormData(data: FormData): string {
  return Object.entries(data)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value ?? ''))}`)
    .join('&');
}

function phpUrlDecode(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

export function parseServerCommResponse(response: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const part of response.split('&')) {
    if (!part) continue;
    const separator = part.indexOf('=');
    const key = separator === -1 ? part : part.slice(0, separator);
    const value = separator === -1 ? '' : part.slice(separator + 1);
    parsed[phpUrlDecode(key)] = phpUrlDecode(value);
  }

  return parsed;
}

export type HttpRequestOptions = {
  host: string;
  method: 'GET' | 'POST';
  page: string;
  data: FormData;
  authentication?: string;
};

export function requestForm({ host, method, page, data, authentication }: HttpRequestOptions): Promise<string> {
  const encoded = encodeFormData(data);
  const path = method === 'GET' ? `${page}?${encoded}` : `${page}?`;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host,
        port: 80,
        method,
        path,
        headers: {
          Host: host,
          'User-Agent': 'PHP',
          Connection: 'close',
          ...(authentication ? { Authorization: `Basic ${Buffer.from(authentication).toString('base64')}` } : {}),
          ...(method === 'POST'
            ? {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(encoded),
              }
            : {}),
        },
      },
      (res) => {
        res.setEncoding('utf8');
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve(body.trim()));
      },
    );

    req.on('error', reject);
    if (method === 'POST') req.write(encoded);
    req.end();
  });
}

export async function sendServerComm(
  target: Pick<TelSyncTarget, 'host' | 'location'>,
  data: FormData,
): Promise<Record<string, string>> {
  const response = await requestForm({
    host: target.host,
    method: 'POST',
    page: target.location,
    data,
  });

  return parseServerCommResponse(response);
}

export async function sendSms(config: SmsConfig, nr: string, sms: string): Promise<boolean> {
  const response = await requestForm({
    host: config.gatewayHost,
    method: 'GET',
    page: config.gatewayPage,
    authentication: config.gatewayAuth,
    data: {
      gsm: nr,
      body: sms,
      sender: config.sender,
    },
  });

  return response.slice(0, 2) === 'OK';
}
