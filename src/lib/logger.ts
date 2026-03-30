import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';

function createLogger() {
  const usePretty =
    process.env.NODE_ENV !== 'production' && process.env.LOG_PRETTY !== '0';

  if (usePretty) {
    // Pino's default `transport` uses worker threads (`pino-pretty` as target).
    // Under Next.js dev (Turbopack) that often fails silently — no output.
    // Piping through pino-pretty as the destination stream avoids workers.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional dev-only dep, keeps prod from eagerly loading it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pretty = require('pino-pretty') as any;
    return pino(
      { level },
      pretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      }),
    );
  }

  return pino({ level });
}

export const logger = createLogger();
