'use client';

import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AccountStatusResponse = {
  needsEmailOnboarding?: boolean;
  login?: string | null;
  huisemail?: string | null;
  email?: string | null;
  displayName?: string | null;
  error?: string;
};

export default function EmailInstellenPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [currentLogin, setCurrentLogin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationEmailSentTo, setVerificationEmailSentTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (verificationEmailSentTo) return;
    if (!session?.user) {
      router.replace('/login?callbackUrl=/account/email-instellen');
      return;
    }

    let cancelled = false;
    fetch('/api/account/status', { credentials: 'include' })
      .then(async (r) => {
        const data = (await r.json()) as AccountStatusResponse;
        if (cancelled) return;
        if (!r.ok) {
          setError(data.error ?? 'Kon accountstatus niet laden.');
          setLoading(false);
          return;
        }
        if (data.needsEmailOnboarding !== true) {
          router.replace('/rooster-inzien');
          return;
        }
        setCurrentLogin(data.login ?? null);
        const prefill = (data.huisemail || data.email || '').trim();
        setEmail(prefill);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Kon accountstatus niet laden.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user, isPending, router, verificationEmailSentTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const r = await fetch('/api/account/email-instellen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), inviteInitiatedOrigin: origin }),
      });
      const data = (await r.json()) as { ok?: boolean; message?: string; error?: string };
      if (!r.ok) {
        setError(data.error ?? 'Opslaan mislukt.');
        return;
      }

      const sentTo = email.trim().toLowerCase();
      setVerificationEmailSentTo(sentTo);
      await authClient.signOut();
    } catch {
      setError('Opslaan mislukt. Probeer het later opnieuw.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isPending || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Laden…</p>
      </div>
    );
  }

  if (!session?.user && !verificationEmailSentTo) {
    return null;
  }

  return (
    <>
      <Head>
        <title>E-mailadres instellen | Doktersdienst</title>
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-10">
        <div className="w-full max-w-md space-y-6 rounded-lg border-2 border-gray-300 p-5">
          <div className="flex justify-center">
            <Image
              src="/logo.png"
              alt="DoktersDienst logo"
              width={280}
              height={70}
              className="h-auto w-full max-w-[240px]"
              priority
              unoptimized
            />
          </div>

          <div className="space-y-2 text-center">
            <h1 className="text-xl font-bold">E-mailadres instellen</h1>
            <p className="text-sm text-muted-foreground">
              Stel het e-mailadres in waarmee u voortaan inlogt. U ontvangt daarna een
              verificatielink om uw account te bevestigen en eventueel een nieuw wachtwoord in te
              stellen.
            </p>
          </div>

          {verificationEmailSentTo ? (
            <div className="space-y-4" role="status">
              <p className="text-sm font-medium text-green-700">
                Verificatiemail verstuurd
              </p>
              <p className="text-sm text-muted-foreground">
                We hebben een e-mail gestuurd naar{' '}
                <strong className="text-foreground">{verificationEmailSentTo}</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                Ga verder met het instellen van uw account door op de link in die e-mail te
                klikken. Daarmee bevestigt u uw e-mailadres en kunt u eventueel een nieuw
                wachtwoord instellen.
              </p>
              <p className="text-xs text-muted-foreground">
                Geen mail ontvangen? Controleer ook uw spam-folder. U kunt deze pagina sluiten;
                de link in de e-mail leidt u verder.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {currentLogin && !currentLogin.includes('@') && (
                <p className="text-sm text-muted-foreground">
                  Uw huidige loginnaam is <strong>{currentLogin}</strong>. Na verificatie wordt
                  deze vervangen door uw e-mailadres.
                </p>
              )}
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mailadres voor toekomstig inloggen</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isSubmitting}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Bezig…' : 'Verificatiemail versturen'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
