import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { alias } from 'drizzle-orm/pg-core';
import { deelnemerChipInitials, formatDeelnemerDisplayName } from '@/lib/deelnemer-display';
import {
  formatAmsterdamDateLabelFromUnixSeconds,
  formatAmsterdamTimeFromUnixSeconds,
} from '@/lib/amsterdamWallTime';

const { diensten: dienstenTable, deelnemers, waarneemgroepdeelnemers, waarneemgroepen } = schema;
const GROEP_SECRETARIS = 2;

/** Same format as lijst deelnemers: achternaam, voornaam, voorletterstussenvoegsel */
function formatDeelnemerListName(fields: {
  achternaam: string | null;
  voornaam: string | null;
  voorletterstussenvoegsel: string | null;
}): string {
  return (
    [fields.achternaam, fields.voornaam, fields.voorletterstussenvoegsel]
      .filter(Boolean)
      .join(', ') ||
    formatDeelnemerDisplayName(fields) ||
    'Onbekend'
  );
}

function toHeaders(incoming: NextApiRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null)
      h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

/**
 * GET /api/overnames/pending
 *
 * Returns pending overname proposals visible to the logged-in doctor.
 * - Regular doctors see proposals targeted at them (iddeelnovern = self).
 * - Secretaris users also see all proposals in their waarneemgroepen.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get the logged-in doctor's deelnemer ID
  const currentDoctor = await db
    .select({ id: deelnemers.id })
    .from(deelnemers)
    .where(eq(deelnemers.login, session.user.email))
    .limit(1);

  const doctorId = currentDoctor[0]?.id;
  if (!doctorId) {
    return res.status(200).json({ verzoeken: [] });
  }

  // Find waarneemgroepen where this doctor is secretaris
  const secretarisGroepen = await db
    .select({ idwaarneemgroep: waarneemgroepdeelnemers.idwaarneemgroep })
    .from(waarneemgroepdeelnemers)
    .where(
      and(
        eq(waarneemgroepdeelnemers.iddeelnemer, doctorId),
        eq(waarneemgroepdeelnemers.idgroep, GROEP_SECRETARIS)
      )
    );
  const secretarisWgIds = secretarisGroepen
    .map((r) => r.idwaarneemgroep)
    .filter((id): id is number => id != null);

  // Build filter:
  // - pending proposals targeting me (iddeelnovern = self)
  // - declined proposals where I'm the original "van" arts or sender (so the
  //   rejection doesn't get forgotten)
  // - secretaris: all pending/declined proposals in their waarneemgroepen
  const pendingForTarget = and(
    eq(dienstenTable.status, 'pending'),
    eq(dienstenTable.iddeelnovern, sql`${doctorId}::integer`)
  );
  const declinedForSender = and(
    eq(dienstenTable.status, 'declined'),
    or(
      eq(dienstenTable.iddeelnemer, sql`${doctorId}::integer`),
      eq(dienstenTable.senderId, sql`${doctorId}::integer`)
    )
  );
  const ownFilter = or(pendingForTarget, declinedForSender);
  const pendingFilter = and(
    eq(dienstenTable.type, 4),
    secretarisWgIds.length > 0
      ? or(
          ownFilter,
          and(
            or(eq(dienstenTable.status, 'pending'), eq(dienstenTable.status, 'declined')),
            inArray(dienstenTable.idwaarneemgroep, secretarisWgIds)
          )
        )
      : ownFilter
  );

  // Aliases for joining original (van) and target (naar) doctor info
  // "van arts" = the doctor whose shift is being taken over (iddeelnemer on the proposal)
  // "naar arts" = the target doctor who would take over (iddeelnovern)
  const originalDeelnemer = alias(deelnemers, 'originalDeelnemer');
  const targetDeelnemer = alias(deelnemers, 'targetDeelnemer');
  const originalDienst = alias(dienstenTable, 'originalDienst');

  const rows = await db
    .select({
      overnameId: dienstenTable.id,
      iddienstovern: dienstenTable.iddienstovern,
      status: dienstenTable.status,
      van: dienstenTable.van,
      tot: dienstenTable.tot,
      originalVan: originalDienst.van,
      originalTot: originalDienst.tot,
      /**
       * Fallback for deciding partial-ness when iddienstovern does not resolve. Of the 21
       * real overname rows -- type 4/6 with a non-null status; the other 141 rows of those
       * types are legacy assignments, see DIENST_TYPES.md -- 9 hold a literal 0, and no
       * dienst has id 0, so those never find a parent.
       *
       * A takeover of a whole shift starts and ends exactly on that shift's boundaries; a
       * partial one lands inside them, so the window's shape answers the question without
       * the reference. Cross-checked against the enclosing type-0 assignment of the same
       * doctor, which finds exactly one parent for all 21, and the two agreed on every row.
       */
      alignsWithShiftBoundaries: sql<boolean>`exists (
        select 1 from diensten s
        where s.idwaarneemgroep = ${dienstenTable.idwaarneemgroep}
          and s.van = ${dienstenTable.van}
          and s.tot = ${dienstenTable.tot}
          and s.type in (0, 1)
      )`,
      iddeelnemer: dienstenTable.iddeelnemer,
      iddeelnovern: dienstenTable.iddeelnovern,
      idwaarneemgroep: dienstenTable.idwaarneemgroep,
      senderId: dienstenTable.senderId,
      originalVoornaam: originalDeelnemer.voornaam,
      originalAchternaam: originalDeelnemer.achternaam,
      originalVoorletterstussenvoegsel: originalDeelnemer.voorletterstussenvoegsel,
      originalInitialen: originalDeelnemer.initialen,
      originalColor: originalDeelnemer.color,
      targetVoornaam: targetDeelnemer.voornaam,
      targetAchternaam: targetDeelnemer.achternaam,
      targetVoorletterstussenvoegsel: targetDeelnemer.voorletterstussenvoegsel,
      targetInitialen: targetDeelnemer.initialen,
      targetColor: targetDeelnemer.color,
      waarneemgroepNaam: waarneemgroepen.naam,
    })
    .from(dienstenTable)
    .leftJoin(originalDeelnemer, eq(dienstenTable.iddeelnemer, originalDeelnemer.id))
    .leftJoin(targetDeelnemer, eq(dienstenTable.iddeelnovern, targetDeelnemer.id))
    .leftJoin(originalDienst, eq(dienstenTable.iddienstovern, originalDienst.id))
    .leftJoin(waarneemgroepen, eq(dienstenTable.idwaarneemgroep, waarneemgroepen.id))
    .where(pendingFilter);

  const verzoeken = rows.map((r) => {
    const vanUnix = Number(r.van ?? 0);
    const totUnix = Number(r.tot ?? 0);
    const vanDate = new Date(vanUnix * 1000);
    // Formatted in Amsterdam explicitly. These strings are built on the server, so
    // anything host-zone-dependent renders correctly on a developer machine and two
    // hours early in the UTC container — which is how the same overname ended up
    // reading 18:00 here and 20:00 in the shift tooltip.
    const datumVan = formatAmsterdamDateLabelFromUnixSeconds(vanUnix);
    const datumTot = formatAmsterdamDateLabelFromUnixSeconds(totUnix);
    // ISO week number
    const d = new Date(vanDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week = Math.round(
      (d.getTime() - new Date(d.getFullYear(), 0, 4).getTime()) / 86400000 / 7 + 1
    );

    const originalInitialen = deelnemerChipInitials(
      {
        initialen: r.originalInitialen,
        voornaam: r.originalVoornaam,
        achternaam: r.originalAchternaam,
      },
      { fallback: '??' }
    );
    const originalNaam = formatDeelnemerListName({
      achternaam: r.originalAchternaam,
      voornaam: r.originalVoornaam,
      voorletterstussenvoegsel: r.originalVoorletterstussenvoegsel,
    });
    const targetInitialen = deelnemerChipInitials(
      {
        initialen: r.targetInitialen,
        voornaam: r.targetVoornaam,
        achternaam: r.targetAchternaam,
      },
      { fallback: '??' }
    );
    const targetNaam = formatDeelnemerListName({
      achternaam: r.targetAchternaam,
      voornaam: r.targetVoornaam,
      voorletterstussenvoegsel: r.targetVoorletterstussenvoegsel,
    });
    // The parent dienst is authoritative when the reference resolves. When it does not,
    // fall back on the shape of the window rather than assuming a full takeover: the old
    // `false` here labelled 4 of the 9 partial takeovers as "volledige dienst".
    const isPartial =
      r.originalVan == null || r.originalTot == null
        ? !r.alignsWithShiftBoundaries
        : Number(r.van) !== Number(r.originalVan) || Number(r.tot) !== Number(r.originalTot);

    return {
      overnameId: r.overnameId == null ? null : Number(r.overnameId),
      iddienstovern: Number(r.iddienstovern ?? 0),
      idwaarneemgroep: r.idwaarneemgroep == null ? null : Number(r.idwaarneemgroep),
      iddeelnovern: r.iddeelnovern == null ? null : Number(r.iddeelnovern),
      iddeelnemer: r.iddeelnemer == null ? null : Number(r.iddeelnemer),
      senderId: r.senderId == null ? null : Number(r.senderId),
      status: r.status,
      overnameVanUnix: Number(r.van ?? 0),
      overnameTotUnix: Number(r.tot ?? 0),
      originalVanUnix: r.originalVan == null ? null : Number(r.originalVan),
      originalTotUnix: r.originalTot == null ? null : Number(r.originalTot),
      datum: datumVan,
      datumVan,
      datumTot,
      van: formatAmsterdamTimeFromUnixSeconds(vanUnix),
      tot: formatAmsterdamTimeFromUnixSeconds(totUnix),
      isPartial,
      week,
      waarneemgroep: r.waarneemgroepNaam ?? `Groep ${r.idwaarneemgroep ?? '?'}`,
      vanArts: {
        initialen: originalInitialen,
        naam: originalNaam,
        voornaam: r.originalVoornaam,
        achternaam: r.originalAchternaam,
        voorletterstussenvoegsel: r.originalVoorletterstussenvoegsel,
        color: r.originalColor ?? '#7b2d8e',
        akkoord: true,
      },
      naarArts: {
        initialen: targetInitialen,
        naam: targetNaam,
        voornaam: r.targetVoornaam,
        achternaam: r.targetAchternaam,
        voorletterstussenvoegsel: r.targetVoorletterstussenvoegsel,
        color: r.targetColor ?? '#7b2d8e',
        akkoord: false,
      },
    };
  });

  return res.status(200).json({ verzoeken });
}
