import { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  isStrongPassword,
  strongPasswordRules,
  STRONG_PASSWORD_MIN_LENGTH,
} from '@/lib/password-policy';

const BRAND_RED = '#d1262c';

const DEFAULT_AFTER_RESET_URL = '/';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const token = useMemo(() => {
    if (!router.isReady) return null;
    const raw = router.query.token;
    return typeof raw === 'string' ? raw : null;
  }, [router.isReady, router.query.token]);

  const emailFromQuery = useMemo(() => {
    if (!router.isReady) return null;
    const raw = router.query.email;
    return typeof raw === 'string' ? raw.trim().toLowerCase() : null;
  }, [router.isReady, router.query.email]);

  const isInviteSetup = useMemo(() => {
    if (!router.isReady) return false;
    return router.query.setup === 'invite';
  }, [router.isReady, router.query.setup]);

  const tokenError = useMemo(() => {
    if (!router.isReady) return null;
    const raw = router.query.error;
    return typeof raw === 'string' ? raw : null;
  }, [router.isReady, router.query.error]);

  const urlErrorMessage =
    tokenError === 'INVALID_TOKEN'
      ? 'De link is ongeldig of verlopen. Vraag een nieuwe resetlink aan.'
      : null;

  const passwordOk = isStrongPassword(password);
  const canSubmit =
    !!token && passwordOk && password === passwordConfirm && passwordConfirm.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Ontbrekende token. Open de link uit uw e-mail opnieuw.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('De wachtwoorden komen niet overeen.');
      return;
    }
    if (!passwordOk) {
      setError('Voldoe aan alle onderstaande wachtwoordvereisten.');
      return;
    }

    setIsLoading(true);
    const { error: resetErr } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setIsLoading(false);

    if (resetErr) {
      setError(resetErr.message ?? 'Wachtwoord wijzigen mislukt');
      return;
    }

    const sessionRes = await authClient.getSession();
    const hasSession = !!sessionRes?.data?.session;

    if (hasSession) {
      await router.push(DEFAULT_AFTER_RESET_URL);
      return;
    }

    const em = emailFromQuery;
    if (!em?.includes('@')) {
      await router.push(`/login?reset=ok`);
      return;
    }

    setIsLoading(true);
    const { error: signErr } = await authClient.signIn.email(
      {
        email: em,
        password,
        callbackURL: DEFAULT_AFTER_RESET_URL,
      },
      {
        onSuccess: () => {
          void router.push(DEFAULT_AFTER_RESET_URL);
        },
      }
    );
    setIsLoading(false);

    if (signErr) {
      setError(
        signErr.message ??
          'Uw wachtwoord is opgeslagen, maar automatisch inloggen lukte niet. Log handmatig in.'
      );
      return;
    }

    await router.push(DEFAULT_AFTER_RESET_URL);
  }

  return (
    <>
      <Head>
        <title>{isInviteSetup ? 'Wachtwoord instellen | Doktersdienst' : 'Nieuw wachtwoord | Doktersdienst'}</title>
      </Head>
      <div className="flex min-h-screen flex-col lg:min-h-0 lg:h-screen lg:flex-row">
        <main className="flex flex-1 flex-col justify-center bg-white px-6 py-10 sm:px-10 lg:overflow-y-auto lg:py-14">
          <div className="mx-auto w-full min-w-[400px] max-w-md rounded-lg border-2 border-gray-300 p-5">
            <div className="mb-8 flex justify-center">
              <Image
                src="/logo.png"
                alt="DoktersDienst logo"
                width={320}
                height={80}
                className="h-auto w-full max-w-[280px]"
                priority
                unoptimized
              />
            </div>

            <h1 className="mb-2 text-center text-xl font-semibold tracking-tight">
              {isInviteSetup ? 'Stel uw wachtwoord in' : 'Nieuw wachtwoord'}
            </h1>
            <p className="mb-6 text-center text-sm text-neutral-600">
              {isInviteSetup
                ? 'Uw e-mailadres is bevestigd. Kies een sterk wachtwoord om uw account te beveiligen.'
                : 'Kies een nieuw wachtwoord voor uw account.'}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {(urlErrorMessage || error) && (
                <p className="text-sm text-destructive" role="alert">
                  {urlErrorMessage ?? error}
                </p>
              )}

              <div className="rounded-md border border-neutral-200 bg-neutral-50/80 px-3 py-3 text-sm text-neutral-700">
                <p className="mb-2 font-medium text-neutral-900">Sterk wachtwoord</p>
                <p className="mb-2 text-neutral-600">
                  Een sterk wachtwoord is moeilijk te raden en beschermt uw gegevens. Vink alle punten
                  hieronder aan voordat u opslaat (minimaal {STRONG_PASSWORD_MIN_LENGTH} tekens).
                </p>
                <ul className="flex flex-col gap-1.5">
                  {strongPasswordRules.map((rule) => {
                    const ok = rule.ok(password);
                    return (
                      <li key={rule.id} className="flex gap-2">
                        <span
                          className={ok ? 'text-green-600' : 'text-neutral-400'}
                          aria-hidden
                        >
                          {ok ? '✓' : '○'}
                        </span>
                        <span className={ok ? 'text-neutral-900' : 'text-neutral-600'}>
                          {rule.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password-new">
                  {isInviteSetup ? 'Wachtwoord' : 'Nieuw wachtwoord'}
                </Label>
                <Input
                  id="password-new"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={STRONG_PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  disabled={isLoading || !token}
                  className="h-10 border-neutral-300 bg-rose-50/50 md:h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password-new2">Herhaal wachtwoord</Label>
                <Input
                  id="password-new2"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  minLength={STRONG_PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  disabled={isLoading || !token}
                  className="h-10 border-neutral-300 bg-rose-50/50 md:h-11"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading || !token || !canSubmit}
                className="mx-auto h-11 min-w-[200px] rounded-xl bg-linear-to-b from-[#d1262c] to-[#a81f24] px-8 text-white shadow-md hover:from-[#b92228] hover:to-[#951b20]"
              >
                {isLoading ? 'Bezig…' : isInviteSetup ? 'Account activeren' : 'Opslaan'}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-neutral-600">
              <Link href="/login" className="font-medium text-foreground underline underline-offset-2 hover:text-[#d1262c]">
                Terug naar inloggen
              </Link>
            </p>
          </div>
        </main>
        <aside
          className="flex min-w-[400px] flex-1 flex-row justify-center px-6 py-12 sm:px-10 lg:min-h-0 lg:py-10"
          style={{ backgroundColor: BRAND_RED }}
        />
      </div>
    </>
  );
}
