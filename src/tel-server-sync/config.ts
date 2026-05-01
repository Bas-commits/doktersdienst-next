export type TelSyncTarget = {
  host: string;
  location: string;
};

export type TelSyncConfig = {
  syncOn: boolean;
  tijdVooruit: number;
  targets: TelSyncTarget[];
};

export type SmsConfig = {
  gatewayHost: string;
  gatewayPage: string;
  gatewayAuth?: string;
  sender: string;
  completionRecipient: string;
  completionMessage: string;
};

export type TelServerSyncConfig = {
  telSync: TelSyncConfig;
  sms: SmsConfig;
};

type Env = Record<string, string | undefined>;

function boolFromEnv(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

function requireEnv(env: Env, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parsePositiveInteger(value: string, key: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Environment variable ${key} must be a positive integer`);
  }
  return parsed;
}

export function parseTelSyncTargets(value: string): TelSyncTarget[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [host, location] = part.split('|');
      if (!host || !location) {
        throw new Error('TEL_SYNC_TARGETS entries must use the format host|location');
      }
      return { host, location };
    });
}

export function loadTelSyncConfig(env: Env = process.env): TelSyncConfig {
  const targets = parseTelSyncTargets(requireEnv(env, 'TEL_SYNC_TARGETS'));

  return {
    syncOn: boolFromEnv(env.TEL_SYNC_ON),
    tijdVooruit: parsePositiveInteger(requireEnv(env, 'TEL_SYNC_TIJD_VOORUIT'), 'TEL_SYNC_TIJD_VOORUIT'),
    targets,
  };
}

export function loadTelServerSyncConfig(env: Env = process.env): TelServerSyncConfig {
  return {
    telSync: loadTelSyncConfig(env),
    sms: {
      gatewayHost: requireEnv(env, 'SMS_GATEWAY_HOST'),
      gatewayPage: requireEnv(env, 'SMS_GATEWAY_PAGE'),
      gatewayAuth: env.SMS_GATEWAY_AUTH,
      sender: requireEnv(env, 'SMS_SENDER'),
      completionRecipient: requireEnv(env, 'TEL_SYNC_COMPLETION_SMS_TO'),
      completionMessage: requireEnv(env, 'TEL_SYNC_COMPLETION_SMS_BODY'),
    },
  };
}
