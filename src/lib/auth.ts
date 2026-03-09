import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

// Pool for Better Auth with auth schema. node-postgres does not pass connection-string
// "options" to the server, so we set search_path on every new connection via onConnect.
const authDbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
  onConnect: async (client) => {
    await client.query('SET search_path TO auth');
  },
});

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

export const auth = betterAuth({
  database: authDbPool,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
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
});
