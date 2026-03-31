import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { Pool } from 'pg';
import { legacyMD5Verify } from '@/lib/legacy-password';
import { pool as appPool } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'auth' });

const rawPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

// All Better Auth tables (deelnemers, account, session, auth_verification) live in public.
const authDbPool = {
  ...rawPool,
  connect: async function () {
    const client = await rawPool.connect();
    await client.query('SET search_path TO public');
    return client;
  },
};

// Placeholder email sending function for password reset
// TODO: Replace with actual email service (Resend, SendGrid, Nodemailer, etc.)
async function sendResetPasswordEmail({
  user,
  url,
  token,
}: {
  user: { email: string; name: string | null };
  url: string;
  token: string;
}) {
  // In development, log the email to console
  // In production, replace this with your email service
  console.log('📧 Password Reset Email:', {
    to: user.email,
    subject: 'Reset your password',
    url,
    token,
  });

  // Example implementation with a real service:
  // await resend.emails.send({
  //   from: 'noreply@example.com',
  //   to: user.email,
  //   subject: 'Reset your password',
  //   html: `<p>Click <a href="${url}">here</a> to reset your password.</p>`,
  // });
}

// Placeholder email sending function for email verification
// TODO: Replace with actual email service
async function sendVerificationEmail({
  user,
  url,
  token,
}: {
  user: { email: string; name: string | null };
  url: string;
  token: string;
}) {
  // In development, log the email to console
  // In production, replace this with your email service
  console.log('📧 Verification Email:', {
    to: user.email,
    subject: 'Verify your email address',
    url,
    token,
  });

  // Example implementation with a real service:
  // await resend.emails.send({
  //   from: 'noreply@example.com',
  //   to: user.email,
  //   subject: 'Verify your email address',
  //   html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
  // });
}

const _authBaseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
export const auth = betterAuth({
  database: authDbPool,
  baseURL: _authBaseURL,
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  trustedOrigins: [
    'http://localhost:3005',
    'http://127.0.0.1:3005',
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
  user: {
    modelName: 'deelnemers',
    fields: {
      email: 'login',
      password: 'encrypted_password',
    } as Record<string, string>,
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'user',
        input: false, // users cannot set their own role at signup
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: sendResetPasswordEmail,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: {
      verify: async ({ hash, password }) => {
        const result = await legacyMD5Verify(hash, password);
        log.info({ hashPrefix: hash?.slice(0, 6), result }, 'password verify');
        return result;
      },
    },
  },
  advanced: {
    database: {
      // User (deelnemers) uses existing numeric ids; session/account/verification need generated ids.
      generateId: (options) => {
        if (options.model === 'user' || options.model === 'deelnemers') return false;
        return crypto.randomUUID();
      },
    },
  },
  session: {
    // Avoid DB hit on every getSession: validate from signed cookie for 5 min
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // seconds
    },
  },
  verification: {
    modelName: 'auth_verification',
  },
  emailVerification: {
    // Optional email verification (can be triggered manually)
    sendVerificationEmail: sendVerificationEmail,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Ensure credential account exists for deelnemers so Better Auth finds the hash and calls our verify.
      // Use app pool to avoid connection contention with Better Auth's authDbPool.
      if (ctx.path === '/sign-in/email' && ctx.body?.email) {
        log.info({ email: ctx.body.email }, 'sign-in attempt started');
        const client = await appPool.connect();
        try {
          await client.query('SET search_path TO public');
          // Debug: check which DB we're connected to
          const dbCheck = await client.query('SELECT current_database(), current_schema(), inet_server_addr(), inet_server_port()');
          log.info({ db: dbCheck.rows[0] }, 'hook connected to database');
          const countRes = await client.query('SELECT COUNT(*) as cnt FROM deelnemers');
          log.info({ deelnemersCount: countRes.rows[0]?.cnt }, 'total deelnemers in table');

          const deelnemerRes = await client.query<{ id: number; encrypted_password: string | null; name: string | null; email_verified: boolean | null }>(
            'SELECT id, encrypted_password, name, email_verified FROM deelnemers WHERE login = $1 LIMIT 1',
            [ctx.body.email]
          );
          log.info({ rowCount: deelnemerRes.rowCount, rows: deelnemerRes.rows }, 'raw deelnemers query result');
          const row = deelnemerRes.rows?.[0];
          log.info(
            { email: ctx.body.email, found: !!row, id: row?.id, hasPassword: !!row?.encrypted_password, name: row?.name, emailVerified: row?.email_verified },
            'deelnemers lookup result'
          );
          if (row?.id != null && row?.encrypted_password) {
            const userId = String(row.id);
            const accountId = `credential-${userId}`;
            // Debug: check constraints from app's perspective
            const constraintCheck = await client.query(
              `SELECT conname, contype FROM pg_constraint WHERE conrelid = 'public.account'::regclass`
            );
            log.info({ constraints: constraintCheck.rows }, 'account table constraints');

            await client.query(
              `INSERT INTO public.account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
               VALUES ($1, $2, $2, 'credential', $3, now(), now())
               ON CONFLICT ON CONSTRAINT account_pkey DO UPDATE SET password = EXCLUDED.password, "updatedAt" = now()`,
              [accountId, userId, row.encrypted_password]
            );
            log.info({ userId, accountId }, 'account upserted');
          } else {
            log.warn({ email: ctx.body.email, id: row?.id, hasPassword: !!row?.encrypted_password }, 'skipped account upsert — missing id or password');
          }
        } catch (err) {
          log.error({ err, email: ctx.body.email }, 'error in sign-in hook');
          throw err;
        } finally {
          client.release();
        }
      } else {
        log.debug({ path: ctx.path }, 'auth middleware passthrough');
      }
    }),
    after: createAuthMiddleware(async () => {}),
  },
});
