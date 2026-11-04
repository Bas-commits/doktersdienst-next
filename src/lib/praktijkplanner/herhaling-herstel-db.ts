import { and, eq } from 'drizzle-orm';
import { schema } from '@/db';
import { dienstTaaktypeIds } from '@/lib/praktijkplanner/dienst-taaktypen';
import { bronDatumVoorFiche } from '@/lib/praktijkplanner/herhaling-herstel';

/** Reden waarom een fiche van een herhaling weg is. Bepaalt of het terug mag komen. */
export const UITZONDERING_VERWIJDERD = 'verwijderd';
export const UITZONDERING_AFWEZIGHEID = 'afwezigheid';

// Drizzle transaction client: dezelfde query-oppervlakte als `db`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

/**
 * Zet het fiche terug dat de herhaling op dit dagdeel voorschrijft.
 *
 * Gebruikt door de twee plekken waar iets over een herhaling heen wordt gehaald: een fiche dat
 * als afwijking over de reeks was geplakt en weer wordt leeggemaakt, en een bevestigde
 * afwezigheid die vervalt. In allebei de gevallen wil de planner terug naar de reeks, niet naar
 * een leeg vakje.
 *
 * Het fiche komt uit de bronweek, want wat er stond voordat er iets overheen ging wordt nergens
 * bewaard. Reeksen van voor `bronstartdatum` hebben dus geen bronweek en kunnen niets
 * terugzetten; die houden het oude gedrag.
 *
 * Er wordt niet gecontroleerd of het dagdeel nog inroosterbaar is. Het fiche stond er, en
 * weigeren terug te zetten wat de planner net weghaalde is vervelender dan een dagdeel dat
 * buiten de matrix valt.
 *
 * Returns: of er iets is teruggezet.
 */
export async function herstelHerhalingsfiche(
  tx: Tx,
  input: {
    idherhaling: number;
    idwaarneemgroep: number;
    iddeelnemer: number;
    datum: string;
    iddagdeel: number;
    userId: number;
  }
): Promise<boolean> {
  const [reeks] = await tx
    .select({ bronstartdatum: schema.planningherhalingen.bronstartdatum })
    .from(schema.planningherhalingen)
    .where(eq(schema.planningherhalingen.id, input.idherhaling))
    .limit(1);
  const bronstartdatum = (reeks as { bronstartdatum: string | null } | undefined)?.bronstartdatum;
  if (!bronstartdatum) return false;

  const bronDatum = bronDatumVoorFiche(bronstartdatum, input.datum);
  const [bron] = await tx
    .select({
      id: schema.planning.id,
      idactiviteit: schema.planning.idactiviteit,
      idactiviteitspecificatie: schema.planning.idactiviteitspecificatie,
      idplannerlocatie: schema.planning.idplannerlocatie,
      idbeschikbaarheidstype: schema.planningbeschikbaarheid.idbeschikbaarheidstype,
    })
    .from(schema.planning)
    .leftJoin(
      schema.planningbeschikbaarheid,
      eq(schema.planningbeschikbaarheid.idplanning, schema.planning.id)
    )
    .where(
      and(
        eq(schema.planning.idwaarneemgroep, input.idwaarneemgroep),
        eq(schema.planning.iddeelnemer, input.iddeelnemer),
        eq(schema.planning.datum, bronDatum),
        eq(schema.planning.iddagdeel, input.iddagdeel)
      )
    )
    .limit(1);
  const sjabloon = bron as
    | {
        id: number;
        idactiviteit: number | null;
        idactiviteitspecificatie: number | null;
        idplannerlocatie: number | null;
        idbeschikbaarheidstype: number | null;
      }
    | undefined;
  if (!sjabloon) return false;

  const bronTaken = (await tx
    .select({
      idtaaktype: schema.planningtaak.idtaaktype,
      positie: schema.planningtaak.positie,
    })
    .from(schema.planningtaak)
    .where(eq(schema.planningtaak.idplanning, sjabloon.id))) as Array<{
    idtaaktype: number;
    positie: number;
  }>;

  /*
    Diensten horen niet bij het weekpatroon; die staan er omdat iemand ze bewust heeft
    neergezet. Een herhaling neemt ze niet mee, dus terugzetten mag ze ook niet verzinnen.
  */
  const diensten = await dienstTaaktypeIds(input.idwaarneemgroep);
  const taken = bronTaken.filter((taak) => !diensten.has(taak.idtaaktype));
  const heeftInhoud =
    sjabloon.idactiviteit != null ||
    sjabloon.idplannerlocatie != null ||
    sjabloon.idbeschikbaarheidstype != null ||
    taken.length > 0;
  if (!heeftInhoud) return false;

  const [aangemaakt] = await tx
    .insert(schema.planning)
    .values({
      idwaarneemgroep: input.idwaarneemgroep,
      iddeelnemer: input.iddeelnemer,
      datum: input.datum,
      iddagdeel: input.iddagdeel,
      idactiviteit: sjabloon.idactiviteit,
      idactiviteitspecificatie: sjabloon.idactiviteitspecificatie,
      idplannerlocatie: sjabloon.idplannerlocatie,
      createdBy: input.userId,
      updatedBy: input.userId,
    })
    .returning({ id: schema.planning.id });
  const idplanning = (aangemaakt as { id: number } | undefined)?.id;
  if (idplanning == null) return false;

  if (taken.length > 0) {
    await tx.insert(schema.planningtaak).values(
      taken.map((taak) => ({
        idplanning,
        idtaaktype: taak.idtaaktype,
        positie: taak.positie,
      }))
    );
  }
  if (sjabloon.idbeschikbaarheidstype != null) {
    await tx.insert(schema.planningbeschikbaarheid).values({
      idplanning,
      idbeschikbaarheidstype: sjabloon.idbeschikbaarheidstype,
      updatedBy: input.userId,
    });
  }
  await tx.insert(schema.planningherhalingslots).values({
    idherhaling: input.idherhaling,
    idplanning,
    reeksdatum: input.datum,
    // Geen bronslot en geen afwijking: dit is weer gewoon wat de reeks voorschrijft.
    isBronslot: false,
    isUitzondering: false,
  });

  await tx
    .delete(schema.planningherhalinguitzonderingen)
    .where(
      and(
        eq(schema.planningherhalinguitzonderingen.idherhaling, input.idherhaling),
        eq(schema.planningherhalinguitzonderingen.reeksdatum, input.datum),
        eq(schema.planningherhalinguitzonderingen.iddagdeel, input.iddagdeel)
      )
    );
  return true;
}

/**
 * Zet het fiche van de herhaling terug nadat een afwezigheid is vervallen.
 *
 * Een bevestigde afwezigheid haalt de planning van dat dagdeel weg en laat een uitzondering
 * achter van het type `afwezigheid`. Dat type is het verschil tussen "dit dagdeel is
 * weggehaald" en "hier stond een afwezigheid overheen": alleen het tweede hoort terug te
 * komen zodra de afwezigheid weg is.
 *
 * Staat er ondertussen alweer iets op het dagdeel, dan blijft dat staan. De planner heeft dan
 * na de afwezigheid iets nieuws neergezet en dat overschrijven zou werk weggooien.
 */
export async function herstelNaAfwezigheid(
  tx: Tx,
  input: {
    idwaarneemgroep: number;
    iddeelnemer: number;
    datum: string;
    iddagdeel: number;
    userId: number;
  }
): Promise<boolean> {
  const [bezet] = await tx
    .select({ id: schema.planning.id })
    .from(schema.planning)
    .where(
      and(
        eq(schema.planning.idwaarneemgroep, input.idwaarneemgroep),
        eq(schema.planning.iddeelnemer, input.iddeelnemer),
        eq(schema.planning.datum, input.datum),
        eq(schema.planning.iddagdeel, input.iddagdeel)
      )
    )
    .limit(1);
  if (bezet != null) return false;

  const [uitzondering] = await tx
    .select({ idherhaling: schema.planningherhalinguitzonderingen.idherhaling })
    .from(schema.planningherhalinguitzonderingen)
    .innerJoin(
      schema.planningherhalingen,
      eq(schema.planningherhalingen.id, schema.planningherhalinguitzonderingen.idherhaling)
    )
    .where(
      and(
        eq(schema.planningherhalinguitzonderingen.reeksdatum, input.datum),
        eq(schema.planningherhalinguitzonderingen.iddagdeel, input.iddagdeel),
        eq(schema.planningherhalinguitzonderingen.type, UITZONDERING_AFWEZIGHEID),
        eq(schema.planningherhalingen.idwaarneemgroep, input.idwaarneemgroep),
        eq(schema.planningherhalingen.iddeelnemer, input.iddeelnemer)
      )
    )
    .limit(1);
  const idherhaling = (uitzondering as { idherhaling: number } | undefined)?.idherhaling;
  if (idherhaling == null) return false;

  return herstelHerhalingsfiche(tx, { ...input, idherhaling });
}
