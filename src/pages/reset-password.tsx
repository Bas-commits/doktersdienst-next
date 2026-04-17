import { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BRAND_RED = '#d1262c';

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

  const tokenError = useMemo(() => {
    if (!router.isReady) return null;
    const raw = router.query.error;
    return typeof raw === 'string' ? raw : null;
  }, [router.isReady, router.query.error]);

  const urlErrorMessage =
    tokenError === 'INVALID_TOKEN'
      ? 'De link is ongeldig of verlopen. Vraag een nieuwe resetlink aan.'
      : null;

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
    if (password.length < 8) {
      setError('Het wachtwoord moet minimaal 8 tekens zijn.');
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

    await router.push('/login?reset=ok');
  }

  return (
    <>
      <Head>
        <title>Nieuw wachtwoord | Doktersdienst</title>
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

            <h1 className="mb-2 text-center text-xl font-semibold tracking-tight">Nieuw wachtwoord</h1>
            <p className="mb-6 text-center text-sm text-neutral-600">Kies een nieuw wachtwoord voor uw account.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {(urlErrorMessage || error) && (
                <p className="text-sm text-destructive" role="alert">
                  {urlErrorMessage ?? error}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="password-new">Nieuw wachtwoord</Label>
                <Input
                  id="password-new"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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
                  minLength={8}
                  autoComplete="new-password"
                  disabled={isLoading || !token}
                  className="h-10 border-neutral-300 bg-rose-50/50 md:h-11"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading || !token}
                className="mx-auto h-11 min-w-[200px] rounded-xl bg-linear-to-b from-[#d1262c] to-[#a81f24] px-8 text-white shadow-md hover:from-[#b92228] hover:to-[#951b20]"
              >
                {isLoading ? 'Bezig…' : 'Opslaan'}
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
