import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { Pool } from 'pg';

const rawPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

// node-postgres Pool does not support onConnect; options in connection string are not
// always passed. Wrap connect() so every connection sets search_path to auth before use.
const authDbPool = {
  ...rawPool,
  connect: async function () {
    const client = await rawPool.connect();
    await client.query('SET search_path TO auth');
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

// #region agent log
const _authBaseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
fetch('http://127.0.0.1:7253/ingest/a82f229b-2fdf-4ed8-b109-9a2c6d129ff7', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    location: 'auth.ts:baseURL',
    message: 'Better Auth baseURL (JWT iss source)',
    data: { baseURL: _authBaseURL, BETTER_AUTH_URL_set: !!process.env.BETTER_AUTH_URL },
    timestamp: Date.now(),
    hypothesisId: 'A',
  }),
}).catch(() => {});
// #endregion
export const auth = betterAuth({
  database: authDbPool,
  baseURL: _authBaseURL,
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  user: {
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
    // Email verification is optional (not required for sign-in)
    requireEmailVerification: false,
    // Password reset is enabled
    sendResetPassword: sendResetPasswordEmail,
    // Password requirements
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  emailVerification: {
    // Optional email verification (can be triggered manually)
    sendVerificationEmail: sendVerificationEmail,
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
