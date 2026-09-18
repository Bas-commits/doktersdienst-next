import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  getAuthenticatedUser,
  getUserWaarneemgroepIds,
  isSecretarisInWaarneemgroep,
} from '@/lib/api-auth';
import { GROEP_ADMINISTRATOR } from '@/lib/roles';
import { sendDoktersdienstRoosterEmailViaResend } from '@/lib/resend-email';
import type { RoosterEmailEntry } from '@email/doktersdienst-rooster';

const { diensten: dienstenTable, deelnemers } = schema;

const MAANDNAMEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDatum(d: Date): string {
  const dag = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'][d.getDay()];
  return `${dag} ${d.getDate()} ${MAANDNAMEN[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTijd(van: Date, tot: Date): string {
  return `${pad2(van.getHours())}:${pad2(van.getMinutes())} - ${pad2(tot.getHours())}:${pad2(tot.getMinutes())}`;
}

function periodeLabel(vanMaand: number, vanJaar: number, totMaand: number, totJaar: number): string {
  const vanLabel = `${MAANDNAMEN[vanMaand]} ${vanJaar}`;
  const totLabel = `${MAANDNAMEN[totMaand]} ${totJaar}`;
  return vanMaand === totMaand && vanJaar === totJaar ? vanLabel : `${vanLabel} t/m ${totLabel}`;
}

async function queryDiensten(
  waarneemgroepIds: number[],
  vanMaand: number,
  vanJaar: number,
  totMaand: number,
  totJaar: number,
  iddeelnemer?: number,
): Promise<RoosterEmailEntry[]> {
  const vanGte = Math.floor(new Date(vanJaar, vanMaand, 1).getTime() / 1000);
  const totLte = Math.floor(new Date(totJaar, totMaand + 1, 0, 23, 59, 59).getTime() / 1000);

  const whereConditions = [
    gte(dienstenTable.van, vanGte),
    lte(dienstenTable.tot, totLte),
    inArray(dienstenTable.idwaarneemgroep, waarneemgroepIds),
    inArray(dienstenTable.type, [0, 1, 5, 6, 11]),
  ];

  if (iddeelnemer != null) {
    whereConditions.push(eq(dienstenTable.iddeelnemer, iddeelnemer));
  }

  const rows = await db
    .select({
      van: dienstenTable.van,
      tot: dienstenTable.tot,
      type: dienstenTable.type,
      voornaam: deelnemers.voornaam,
      achternaam: deelnemers.achternaam,
    })
    .from(dienstenTable)
    .leftJoin(deelnemers, eq(dienstenTable.iddeelnemer, deelnemers.id))
    .where(and(...whereConditions))
    .orderBy(dienstenTable.van);

  return rows
    .filter((r) => r.type !== 1)
    .map((r) => {
      const van = new Date(Number(r.van) * 1000);
      const tot = new Date(Number(r.tot) * 1000);
      return {
        datum: formatDatum(van),
        tijd: formatTijd(van, tot),
        deelnemer: [r.voornaam, r.achternaam].filter(Boolean).join(' ') || 'Onbekend',
      };
    });
}

type SuccessResponse = { ok: true; verzonden?: number; mislukt?: string[] };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Niet ingelogd' });
  }

  const { mode, vanMaand, vanJaar, totMaand, totJaar } = req.body as {
    mode?: 'deelnemer' | 'secretaris';
    vanMaand?: number;
    vanJaar?: number;
    totMaand?: number;
    totJaar?: number;
  };

  if (vanMaand == null || vanJaar == null || totMaand == null || totJaar == null) {
    return res.status(400).json({ error: 'Periode ontbreekt' });
  }

  const periode = periodeLabel(vanMaand, vanJaar, totMaand, totJaar);

  try {
    if (mode === 'secretaris') {
      return await handleSecretaris(req, res, user, vanMaand, vanJaar, totMaand, totJaar, periode);
    }
    return await handleDeelnemer(req, res, user, vanMaand, vanJaar, totMaand, totJaar, periode);
  } catch (err) {
    console.error('[api/rooster-email]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Interne fout bij het versturen',
    });
  }
}

async function handleDeelnemer(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | { error: string }>,
  user: { id: number; email: string; idgroep: number | null; isAdmin: boolean },
  vanMaand: number,
  vanJaar: number,
  totMaand: number,
  totJaar: number,
  periode: string,
) {
  const { to, eigenDiensten } = req.body as { to?: string; eigenDiensten?: boolean };

  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return res.status(400).json({ error: 'Ongeldig e-mailadres' });
  }

  const waarneemgroepIds = await getUserWaarneemgroepIds(user.id);
  if (waarneemgroepIds.length === 0) {
    return res.status(400).json({ error: 'Geen waarneemgroepen gevonden' });
  }

  const entries = await queryDiensten(
    waarneemgroepIds, vanMaand, vanJaar, totMaand, totJaar,
    eigenDiensten ? user.id : undefined,
  );

  const [deelnemerRow] = await db
    .select({ voornaam: deelnemers.voornaam })
    .from(deelnemers)
    .where(eq(deelnemers.id, user.id))
    .limit(1);

  await sendDoktersdienstRoosterEmailViaResend({
    to,
    userName: deelnemerRow?.voornaam ?? null,
    periode,
    eigenDiensten: eigenDiensten ?? false,
    entries,
  });

  return res.status(200).json({ ok: true });
}

async function handleSecretaris(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | { error: string }>,
  user: { id: number; email: string; idgroep: number | null; isAdmin: boolean },
  vanMaand: number,
  vanJaar: number,
  totMaand: number,
  totJaar: number,
  periode: string,
) {
  const { idwaarneemgroep, deelnemerIds } = req.body as {
    idwaarneemgroep?: number;
    deelnemerIds?: number[];
  };

  if (!idwaarneemgroep || !deelnemerIds?.length) {
    return res.status(400).json({ error: 'Waarneemgroep en deelnemers zijn verplicht' });
  }

  const isAdmin = user.idgroep === GROEP_ADMINISTRATOR;
  if (!isAdmin) {
    const isSecretaris = await isSecretarisInWaarneemgroep(user.id, idwaarneemgroep);
    if (!isSecretaris) {
      return res.status(403).json({ error: 'Alleen secretaris of admin mag bevestigingsmails versturen' });
    }
  }

  // Haal de deelnemers op met hun e-mailadres en naam
  const deelnemerRows = await db
    .select({
      id: deelnemers.id,
      voornaam: deelnemers.voornaam,
      achternaam: deelnemers.achternaam,
      login: deelnemers.login,
      email: deelnemers.email,
    })
    .from(deelnemers)
    .where(inArray(deelnemers.id, deelnemerIds));

  let verzonden = 0;
  const mislukt: string[] = [];

  for (const d of deelnemerRows) {
    const emailAdres = d.login?.trim() || d.email?.trim();
    const naam = [d.voornaam, d.achternaam].filter(Boolean).join(' ') || 'Onbekend';

    if (!emailAdres || !emailAdres.includes('@')) {
      mislukt.push(`${naam}: geen e-mailadres`);
      continue;
    }

    const entries = await queryDiensten(
      [idwaarneemgroep], vanMaand, vanJaar, totMaand, totJaar, d.id ?? undefined,
    );

    try {
      await sendDoktersdienstRoosterEmailViaResend({
        to: emailAdres,
        userName: d.voornaam ?? null,
        periode,
        eigenDiensten: true,
        entries,
        bevestiging: true,
      });
      verzonden++;
    } catch (err) {
      mislukt.push(`${naam}: ${err instanceof Error ? err.message : 'onbekende fout'}`);
    }
  }

  return res.status(200).json({ ok: true, verzonden, mislukt: mislukt.length > 0 ? mislukt : undefined });
}
