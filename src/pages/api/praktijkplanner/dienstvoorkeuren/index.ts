import type { NextApiRequest, NextApiResponse } from 'next';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  canAccessPraktijkplannerParticipant,
  resolvePraktijkplannerAccess,
  sendPraktijkplannerAccessError,
} from '@/lib/praktijkplanner/access';
import { isIsoDate, parsePositiveInteger } from '@/lib/praktijkplanner/dates';
import type {
  PraktijkplannerDienstvoorkeur,
  PraktijkplannerDienstvoorkeurWaarde,
} from '@/types/praktijkplanner';

type VoorkeurMutatie = {
  iddeelnemer: unknown;
  datum: unknown;
  iddagdeel: unknown;
  /** Leeg betekent: haal de voorkeur weg. */
  voorkeur?: unknown;
  /** Ontbreekt hij, dan is het een aanvraag. Vastleggen moet je willen zeggen. */
  isVoorlopig?: unknown;
};

type Data =
  | { voorkeuren: PraktijkplannerDienstvoorkeur[] }
  | { success: true }
  | { error: string };

const WAARDEN: readonly PraktijkplannerDienstvoorkeurWaarde[] = ['graag', 'liever_niet'];

class VoorkeurError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 500 = 400
  ) {
    super(message);
    this.name = 'VoorkeurError';
  }
}

function oneQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseWaarde(value: unknown): PraktijkplannerDienstvoorkeurWaarde | null {
  return WAARDEN.includes(value as PraktijkplannerDienstvoorkeurWaarde)
    ? (value as PraktijkplannerDienstvoorkeurWaarde)
    : null;
}

/**
 * De dag is voorbij.
 *
 * DoktersDienst weigert hetzelfde, met de reden dat een voorkeur uit het verleden de
 * vastlegging is waarop het rooster is gebouwd. Hier wordt op de dag afgerond en niet op het
 * dagdeel: een dagdeel heeft geen eindtijd, dus wanneer de nacht van gisteren precies afliep is
 * niet uit de gegevens te halen. De dag erna is het antwoord dat niemand hoeft uit te leggen.
 */
function isVoorbij(datum: string): boolean {
  const nu = new Date();
  const maand = String(nu.getMonth() + 1).padStart(2, '0');
  const dag = String(nu.getDate()).padStart(2, '0');
  return datum < [nu.getFullYear(), maand, dag].join('-');
}

async function laadVoorkeuren(
  idwaarneemgroep: number,
  start: string,
  end: string,
  iddeelnemer?: number
): Promise<PraktijkplannerDienstvoorkeur[]> {
  const tabel = schema.praktijkplannerdienstvoorkeuren;
  const rijen = await db
    .select({
      id: tabel.id,
      iddeelnemer: tabel.iddeelnemer,
      datum: tabel.datum,
      iddagdeel: tabel.iddagdeel,
      voorkeur: tabel.voorkeur,
      isVoorlopig: tabel.isVoorlopig,
    })
    .from(tabel)
    .where(
      and(
        eq(tabel.idwaarneemgroep, idwaarneemgroep),
        gte(tabel.datum, start),
        lte(tabel.datum, end),
        ...(iddeelnemer == null ? [] : [eq(tabel.iddeelnemer, iddeelnemer)])
      )
    )
    .orderBy(asc(tabel.datum), asc(tabel.iddagdeel));

  return rijen.flatMap((rij) => {
    const waarde = parseWaarde(rij.voorkeur);
    return waarde == null
      ? []
      : [
          {
            id: rij.id,
            iddeelnemer: rij.iddeelnemer,
            datum: rij.datum,
            iddagdeel: rij.iddagdeel,
            voorkeur: waarde,
            isVoorlopig: rij.isVoorlopig,
          },
        ];
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method === 'GET') {
    const accessResult = await resolvePraktijkplannerAccess(
      req,
      oneQueryValue(req.query.idwaarneemgroep),
      'afwezigheid:self'
    );
    if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

    const start = oneQueryValue(req.query.start);
    const end = oneQueryValue(req.query.end);
    const gevraagd = parsePositiveInteger(oneQueryValue(req.query.iddeelnemer));
    if (!isIsoDate(start) || !isIsoDate(end) || start > end) {
      return res.status(400).json({ error: 'Een geldig datumbereik is verplicht.' });
    }

    // Zonder iddeelnemer: de hele groep, want de planner legt dit over het weekrooster heen.
    // Een andere deelnemer opvragen mag alleen als planner, net als bij afwezigheden.
    const deelnemer =
      gevraagd == null
        ? undefined
        : accessResult.access.isManager || gevraagd === accessResult.access.user.id
          ? gevraagd
          : accessResult.access.user.id;

    if (
      deelnemer != null &&
      !(await canAccessPraktijkplannerParticipant(accessResult.access, deelnemer))
    ) {
      return res.status(403).json({ error: 'Geen toegang tot deze deelnemer.' });
    }

    try {
      return res.status(200).json({
        voorkeuren: await laadVoorkeuren(
          accessResult.access.idwaarneemgroep,
          start,
          end,
          deelnemer ?? undefined
        ),
      });
    } catch (error) {
      console.error('[praktijkplanner/dienstvoorkeuren GET]', error);
      return res.status(500).json({ error: 'De dienstvoorkeuren konden niet worden geladen.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as { idwaarneemgroep?: unknown; voorkeuren?: unknown };
  const accessResult = await resolvePraktijkplannerAccess(
    req,
    body.idwaarneemgroep,
    'afwezigheid:self'
  );
  if (!accessResult.ok) return sendPraktijkplannerAccessError(res, accessResult);

  if (
    !Array.isArray(body.voorkeuren) ||
    body.voorkeuren.length === 0 ||
    body.voorkeuren.length > 200
  ) {
    return res.status(400).json({ error: 'Voeg een tot maximaal 200 wijzigingen toe.' });
  }

  try {
    const mutaties = (body.voorkeuren as VoorkeurMutatie[]).map((invoer) => {
      const iddeelnemer = parsePositiveInteger(invoer.iddeelnemer);
      const iddagdeel = parsePositiveInteger(invoer.iddagdeel);
      const leeg = invoer.voorkeur == null || invoer.voorkeur === '';
      const voorkeur = leeg ? null : parseWaarde(invoer.voorkeur);
      if (
        !iddeelnemer ||
        !iddagdeel ||
        !isIsoDate(invoer.datum) ||
        (!leeg && voorkeur == null) ||
        (invoer.isVoorlopig != null && typeof invoer.isVoorlopig !== 'boolean')
      ) {
        throw new VoorkeurError('Een wijziging bevat ongeldige gegevens.');
      }
      return {
        iddeelnemer,
        datum: invoer.datum,
        iddagdeel,
        voorkeur,
        isVoorlopig: invoer.isVoorlopig !== false,
      };
    });

    const daypartIds = [...new Set(mutaties.map((mutatie) => mutatie.iddagdeel))];
    const bestaande = await db
      .select({ id: schema.dagdelen.id })
      .from(schema.dagdelen)
      .where(inArray(schema.dagdelen.id, daypartIds));
    if (bestaande.length !== daypartIds.length) {
      throw new VoorkeurError('Een gekozen dagdeel bestaat niet.');
    }

    for (const mutatie of mutaties) {
      if (!(await canAccessPraktijkplannerParticipant(accessResult.access, mutatie.iddeelnemer))) {
        throw new VoorkeurError('Geen toegang tot deze deelnemer.', 403);
      }
      if (!accessResult.access.isManager && mutatie.iddeelnemer !== accessResult.access.user.id) {
        throw new VoorkeurError('U kunt alleen uw eigen dienstvoorkeur aanpassen.', 403);
      }
      // Dezelfde tweedeling als bij een afwezigheid: een arts vraagt aan, de planner legt vast.
      if (!accessResult.access.isManager && mutatie.voorkeur != null && !mutatie.isVoorlopig) {
        throw new VoorkeurError(
          'Alleen secretarissen en beheerders kunnen een dienstvoorkeur vastleggen.',
          403
        );
      }
      /*
        Ook weghalen mag niet meer als de dag voorbij is. Dat is geen slordigheid: het rooster is
        op die voorkeur gebouwd, dus hem achteraf wissen maakt onnavolgbaar waarom iemand die
        dienst kreeg.
      */
      if (isVoorbij(mutatie.datum)) {
        throw new VoorkeurError(
          'Een dienstvoorkeur uit het verleden kan niet meer worden aangepast.'
        );
      }
    }

    const tabel = schema.praktijkplannerdienstvoorkeuren;
    const gebruiker = accessResult.access.user.id;
    await db.transaction(async (tx) => {
      for (const mutatie of mutaties) {
        const plek = and(
          eq(tabel.idwaarneemgroep, accessResult.access.idwaarneemgroep),
          eq(tabel.iddeelnemer, mutatie.iddeelnemer),
          eq(tabel.datum, mutatie.datum),
          eq(tabel.iddagdeel, mutatie.iddagdeel)
        );
        /*
          Wat de planner heeft vastgelegd is een afspraak, geen wens meer. Een arts mag hem
          daarom niet omzetten of weghalen; hetzelfde slot als bij een bevestigde afwezigheid.
        */
        if (!accessResult.access.isManager) {
          const [staand] = await tx
            .select({ isVoorlopig: tabel.isVoorlopig })
            .from(tabel)
            .where(plek)
            .limit(1);
          if (staand?.isVoorlopig === false) {
            throw new VoorkeurError(
              'Deze dienstvoorkeur is vastgelegd en kan niet meer worden gewijzigd.',
              403
            );
          }
        }
        // Altijd eerst weg, dan eventueel opnieuw. Dat is wat de unieke sleutel toch al
        // afdwingt, en het scheelt een aparte tak voor wisselen tussen graag en liever niet.
        await tx.delete(tabel).where(plek);
        if (mutatie.voorkeur == null) continue;
        await tx.insert(tabel).values({
          idwaarneemgroep: accessResult.access.idwaarneemgroep,
          iddeelnemer: mutatie.iddeelnemer,
          datum: mutatie.datum,
          iddagdeel: mutatie.iddagdeel,
          voorkeur: mutatie.voorkeur,
          isVoorlopig: mutatie.isVoorlopig,
          createdBy: gebruiker,
          updatedBy: gebruiker,
        });
      }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof VoorkeurError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[praktijkplanner/dienstvoorkeuren POST]', error);
    return res.status(500).json({ error: 'De dienstvoorkeur kon niet worden opgeslagen.' });
  }
}
