'use client';

import { useWaarneemgroepen } from '@/hooks/use-waarneemgroepen';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function WaarneemgroepenList() {
  const { data, error, loading } = useWaarneemgroepen();
  const list = data ?? [];

  if (loading) {
    return (
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Waarneemgroepen</CardTitle>
          <CardDescription>Laden…</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Gegevens worden opgehaald.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <>
        <Card className="w-full max-w-4xl border-destructive/50">
          <CardHeader>
            <CardTitle>Waarneemgroepen</CardTitle>
            <CardDescription>Er is een fout opgetreden</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Kon gegevens niet ophalen. Zie melding hieronder.
            </p>
          </CardContent>
        </Card>
        <p className="text-destructive" role="alert">
          {error}
        </p>
      </>
    );
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Waarneemgroepen</CardTitle>
        <CardDescription>
          {list.length === 0
            ? 'Geen waarneemgroepen gevonden.'
            : `${list.length} waarneemgroep${list.length === 1 ? '' : 'en'}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-muted-foreground">Er zijn geen waarneemgroepen.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">Naam</th>
                  <th className="py-2 pr-4 font-medium">E-mail</th>
                  <th className="py-2 pr-4 font-medium">Gespreksopname</th>
                  <th className="py-2 font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{row.naam ?? '—'}</td>
                    <td className="py-2 pr-4">{row.email ?? '—'}</td>
                    <td className="py-2 pr-4">
                      {row.gespreksopname == null
                        ? '—'
                        : row.gespreksopname
                          ? 'Ja'
                          : 'Nee'}
                    </td>
                    <td className="py-2 font-mono text-sm text-muted-foreground">
                      {row.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
