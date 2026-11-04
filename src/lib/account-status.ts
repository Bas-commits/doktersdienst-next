import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';

const { deelnemers } = schema;

export type AccountStatusRow = {
  emailVerified: boolean | null;
  password: string | null;
  login: string | null;
  huisemail: string | null;
  email: string | null;
  name: string | null;
  voornaam: string | null;
  achternaam: string | null;
};

export function needsEmailOnboarding(row: { emailVerified: boolean | null }): boolean {
  return row.emailVerified !== true;
}

export function displayNameFromDeelnemer(row: {
  name: string | null;
  voornaam: string | null;
  achternaam: string | null;
}): string | null {
  return row.name || [row.voornaam, row.achternaam].filter(Boolean).join(' ') || null;
}

export async function getAccountStatusForUser(deelnemerId: number): Promise<AccountStatusRow | null> {
  const [row] = await db
    .select({
      emailVerified: deelnemers.emailVerified,
      password: deelnemers.password,
      login: deelnemers.login,
      huisemail: deelnemers.huisemail,
      email: deelnemers.email,
      name: deelnemers.name,
      voornaam: deelnemers.voornaam,
      achternaam: deelnemers.achternaam,
    })
    .from(deelnemers)
    .where(eq(deelnemers.id, deelnemerId))
    .limit(1);

  return row ?? null;
}
