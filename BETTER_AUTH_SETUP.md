# Better Auth Setup Complete

Better Auth has been successfully configured with email/password authentication using your PostgreSQL database.

## What Was Set Up

### 1. Dependencies Installed
- `better-auth` - Core authentication library

### 2. Environment Variables
Added to `.env.local`:
- `BETTER_AUTH_SECRET` - Secret key for encryption/signing
- `BETTER_AUTH_URL` - Base URL (http://localhost:3000)
- `NEXT_PUBLIC_BETTER_AUTH_URL` - Client-side base URL

### 3. Database Configuration
- Created separate `auth` schema in PostgreSQL
- Configured database pool with `search_path=auth` to isolate Better Auth tables
- Database migrations completed successfully

### 4. Files Created

#### `src/lib/auth.ts`
- Better Auth server configuration
- Email/password authentication enabled
- Password reset enabled (with placeholder email function)
- Email verification optional (not required for sign-in)
- Uses separate database pool configured for `auth` schema

#### `src/lib/auth-client.ts`
- React client configuration
- Exports `authClient` with hooks: `useSession`, `signIn`, `signUp`, `signOut`

#### `src/pages/api/auth/[...all].ts`
- API route handler for all Better Auth endpoints
- Configured for Next.js Pages Router
- Handles all `/api/auth/*` requests

### 5. Database Schema
The following tables were created in the `auth` schema:
- `user` - User accounts (includes optional `role` column, default `'user'`, for app authorization)
- `session` - User sessions
- `account` - Authentication accounts (email/password)
- `verification` - Email verification tokens

**User role:** The `deelnemers` user model has a `role` column (string, default `'user'`). Users cannot set their own role at signup. To change a user's role, update it in the database or use the Better Auth admin API if configured.

## Usage

### Client-Side (React Components)

```tsx
'use client';
import { authClient } from '@/lib/auth-client';

export default function LoginPage() {
  const { data: session, isPending } = authClient.useSession();

  const handleSignUp = async () => {
    const { data, error } = await authClient.signUp.email({
      email: 'user@example.com',
      password: 'password123',
      name: 'John Doe',
    });
    
    if (error) {
      console.error('Sign up error:', error);
    }
  };

  const handleSignIn = async () => {
    const { data, error } = await authClient.signIn.email({
      email: 'user@example.com',
      password: 'password123',
    });
    
    if (error) {
      console.error('Sign in error:', error);
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
  };

  if (isPending) return <div>Loading...</div>;

  return (
    <div>
      {session ? (
        <div>
          <p>Welcome, {session.user.name}!</p>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      ) : (
        <div>
          <button onClick={handleSignIn}>Sign In</button>
          <button onClick={handleSignUp}>Sign Up</button>
        </div>
      )}
    </div>
  );
}
```

### Server-Side (API Routes)

```ts
import { auth } from '@/lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(200).json({ user: session.user });
}
```

## Email Configuration

### Current Status
Placeholder email functions are implemented that log to console. These need to be replaced with a real email service for production.

### To Implement Email Sending

1. **Install an email service** (e.g., Resend, SendGrid, Nodemailer)
2. **Update `src/lib/auth.ts`**:
   - Replace `sendResetPasswordEmail` function
   - Replace `sendVerificationEmail` function

Example with Resend:
```ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendResetPasswordEmail({ user, url }: { user: { email: string }, url: string }) {
  await resend.emails.send({
    from: 'noreply@yourdomain.com',
    to: user.email,
    subject: 'Reset your password',
    html: `<p>Click <a href="${url}">here</a> to reset your password.</p>`,
  });
}
```

## API Endpoints

Better Auth provides the following endpoints at `/api/auth/*`:

- `POST /api/auth/sign-up/email` - Sign up with email/password
- `POST /api/auth/sign-in/email` - Sign in with email/password
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/session` - Get current session
- `POST /api/auth/request-password-reset` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/change-password` - Change password (requires session)
- `POST /api/auth/send-verification-email` - Send verification email

## Configuration Options

Current configuration in `src/lib/auth.ts`:
- ✅ Email/password enabled
- ✅ Password reset enabled
- ❌ Email verification required: **false** (optional)
- ✅ Min password length: 8
- ✅ Max password length: 128
- ✅ Database: PostgreSQL with `auth` schema

## Next Steps

1. **Implement email sending** - Replace placeholder functions with real email service
2. **Create sign-up/sign-in pages** - Build UI for authentication
3. **Add protected routes** - Implement route protection middleware
4. **Test authentication flow** - Verify sign-up, sign-in, and password reset work correctly

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is correct in `.env.local`
- Check that the `auth` schema exists and has proper permissions
- Ensure SSL mode matches your database configuration

### API Route Not Working
- Verify the route file is at `src/pages/api/auth/[...all].ts`
- Check that `bodyParser: false` is set in the config
- Ensure you're using `toNodeHandler` for Pages Router

### Client Not Connecting
- Verify `NEXT_PUBLIC_BETTER_AUTH_URL` matches your server URL
- Check browser console for CORS or network errors
- Ensure cookies are being set (check Application > Cookies in DevTools)

## Documentation

- [Better Auth Docs](https://www.better-auth.com/docs)
- [Email/Password Authentication](https://www.better-auth.com/docs/authentication/email-password)
- [Next.js Integration](https://www.better-auth.com/docs/integrations/next)
