import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const WAARNEMGROEPEN_URL = '/waarneemgroepen';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { data, error: signInError } = await authClient.signIn.email(
      {
        email,
        password,
        callbackURL: WAARNEMGROEPEN_URL,
      },
      {
        onSuccess: () => {
          router.push(WAARNEMGROEPEN_URL);
        },
      }
    );

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message ?? 'Inloggen mislukt');
      return;
    }

    if (data) {
      router.push(WAARNEMGROEPEN_URL);
    }
  }

  return (
    <>
      <Head>
        <title>Inloggen | Doktersdienst</title>
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Inloggen</CardTitle>
            <CardDescription>
              Log in met je e-mailadres en wachtwoord.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              {error && (
                <p
                  className="text-sm text-destructive"
                  role="alert"
                  data-testid="login-error"
                >
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="je@voorbeeld.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Wachtwoord</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Je wachtwoord"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="login-submit"
              >
                {isLoading ? 'Bezig met inloggen…' : 'Inloggen'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Nog geen account?{' '}
                <Link
                  href="/signup"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Registreren
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </main>
    </>
  );
}
