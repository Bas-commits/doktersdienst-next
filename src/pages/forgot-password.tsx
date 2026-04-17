import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BRAND_RED = '#d1262c';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error: reqError } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${origin}/reset-password`,
    });

    setIsLoading(false);

    if (reqError) {
      setError(reqError.message ?? 'Aanvraag mislukt');
      return;
    }

    setDone(true);
  }

  return (
    <>
      <Head>
        <title>Wachtwoord vergeten | Doktersdienst</title>
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

            <h1 className="mb-2 text-center text-xl font-semibold tracking-tight">Wachtwoord resetten</h1>
            <p className="mb-6 text-center text-sm text-neutral-600">
              Vul uw e-mailadres in. Als dit bij ons bekend is, ontvangt u een link om een nieuw wachtwoord te kiezen.
            </p>

            {done ? (
              <p className="text-center text-sm text-neutral-700" role="status">
                Als dit e-mailadres bij ons bekend is, is er een bericht verstuurd. Controleer uw inbox.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email-forgot">E-mail</Label>
                  <Input
                    id="email-forgot"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={isLoading}
                    className="h-10 border-neutral-300 bg-rose-50/50 md:h-11"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="mx-auto h-11 min-w-[200px] rounded-xl bg-linear-to-b from-[#d1262c] to-[#a81f24] px-8 text-white shadow-md hover:from-[#b92228] hover:to-[#951b20]"
                >
                  {isLoading ? 'Bezig…' : 'Stuur resetlink'}
                </Button>
              </form>
            )}

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
