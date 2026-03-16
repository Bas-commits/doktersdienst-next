import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { jwt } from 'better-auth/plugins';
import { Pool } from 'pg';
import { legacyMD5Verify } from '@/lib/legacy-password';
import { pool as appPool } from '@/lib/db';

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
      verify: async ({ hash, password }) => legacyMD5Verify(hash, password),
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
        const client = await appPool.connect();
        try {
          await client.query('SET search_path TO public');
          const deelnemerRes = await client.query<{ id: number; encrypted_password: string | null }>(
            'SELECT id, encrypted_password FROM deelnemers WHERE login = $1 LIMIT 1',
            [ctx.body.email]
          );
          const row = deelnemerRes.rows?.[0];
          if (row?.id != null && row?.encrypted_password) {
            const userId = String(row.id);
            const accountId = `credential-${userId}`;
            await client.query(
              `INSERT INTO account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
               VALUES ($1, $2, $2, 'credential', $3, now(), now())
               ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, "updatedAt" = now()`,
              [accountId, userId, row.encrypted_password]
            );
          }
        } catch (err) {
          throw err;
        } finally {
          client.release();
        }
      }
    }),
    after: createAuthMiddleware(async () => {}),
  },
  plugins: [
    jwt({
      jwt: {
        definePayload: ({ user }) => {
          const role = (user as { role?: string }).role ?? 'user';
          return {
            sub: user.id,
            // Hasura expects these claims under this namespace for JWT auth
            'https://hasura.io/jwt/claims': {
              'x-hasura-default-role': role,
              'x-hasura-allowed-roles': [role],
              'x-hasura-user-id': user.id,
            },
          };
        },
      },
    }),
  ],
});
