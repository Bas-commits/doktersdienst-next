'use client';

import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';

export default function WachtwoordInstellenPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.replace('/login?callbackUrl=/account/wachtwoord-instellen');
      return;
    }

    window.location.href = '/api/account/wachtwoord-instellen';
  }, [session?.user, isPending, router]);

  return (
    <>
      <Head>
        <title>Wachtwoord instellen | Doktersdienst</title>
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-10">
        <div className="w-full max-w-md space-y-4 rounded-lg border-2 border-gray-300 p-5 text-center">
          <Image
            src="/logo.png"
            alt="DoktersDienst logo"
            width={240}
            height={60}
            className="mx-auto h-auto w-full max-w-[200px]"
            priority
            unoptimized
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : (
            <>
              <h1 className="text-lg font-bold">Wachtwoord instellen</h1>
              <p className="text-sm text-muted-foreground">Even geduld, u wordt doorgestuurd…</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
