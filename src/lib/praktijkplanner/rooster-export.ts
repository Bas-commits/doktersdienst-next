import { downloadWerkboek, type ExcelBlad, type ExcelWaarde } from '@/lib/excel-export';
import type {
  PraktijkplannerAbsenceSlot,
  PraktijkplannerPlanningSlot,
} from '@/types/praktijkplanner';

const WEEKDAGEN = [
  'maandag',
  'dinsdag',
  'woensdag',
  'donderdag',
  'vrijdag',
  'zaterdag',
  'zondag',
];

export type RoosterExportDagdeel = { id: number; naam: string };
export type RoosterExportDeelnemer = { id: number; naam: string };

function sleutel(iddeelnemer: number, datum: string, iddagdeel: number): string {
  return `${iddeelnemer}:${datum}:${iddagdeel}`;
}

function weekdagNaam(datum: string): string {
  const dag = new Date(`${datum}T12:00:00`).getDay();
  return WEEKDAGEN[(dag === 0 ? 7 : dag) - 1];
}

function activiteitTekst(slot: PraktijkplannerPlanningSlot): string {
  if (!slot.activity) return '';
  return slot.activity.naam || slot.activity.afkorting || `Activiteit ${slot.activity.id}`;
}

function takenTekst(slot: PraktijkplannerPlanningSlot): string {
  return slot.tasks
    .map((taak) => taak.omschrijving || taak.afkorting || `Taak ${taak.id}`)
    .join(', ');
}

/**
 * De korte tekst die in een vakje van het weekoverzicht past.
 *
 * Dit is wat het scherm in de fiche zet, in woorden in plaats van in kleuren en pictogrammen.
 * Een afwezigheid wint van de planning, net als op het scherm: staat er allebei iets, dan is de
 * afwezigheid het antwoord op de vraag of iemand er die dag is.
 */
function vakjeTekst(
  slot: PraktijkplannerPlanningSlot | undefined,
  absentie: PraktijkplannerAbsenceSlot | undefined
): string {
  if (absentie && !absentie.isVoorlopig) return absentie.absenceType.naam;
  const delen: string[] = [];
  if (slot) {
    const activiteit = activiteitTekst(slot);
    const specificatie = slot.specification?.naam ?? '';
    if (activiteit) delen.push(specificatie ? `${activiteit} (${specificatie})` : activiteit);
    if (slot.location) delen.push(slot.location.naam);
    const taken = takenTekst(slot);
    if (taken) delen.push(taken);
    if (slot.availability) delen.push(slot.availability.naam);
  }
  if (absentie?.isVoorlopig) delen.push(`${absentie.absenceType.naam} (aangevraagd)`);
  return delen.join(' | ');
}

/**
 * De twee koprijen van het raster: de dag boven het eerste dagdeel, de dagdelen eronder.
 *
 * De dagnaam staat alleen boven het eerste dagdeel en de rest blijft leeg, zodat er in Excel op
 * te filteren valt zonder samengevoegde cellen (die kan deze bibliotheek niet maken).
 */
function rasterKoppen(
  datums: string[],
  dagdelen: RoosterExportDagdeel[]
): { dagKop: ExcelWaarde[]; dagdeelKop: ExcelWaarde[] } {
  const dagKop: ExcelWaarde[] = [''];
  const dagdeelKop: ExcelWaarde[] = ['Dokter'];
  for (const datum of datums) {
    dagdelen.forEach((dagdeel, index) => {
      dagKop.push(
        index === 0 ? `${weekdagNaam(datum)} ${datum.slice(8, 10)}-${datum.slice(5, 7)}` : ''
      );
      dagdeelKop.push(dagdeel.naam);
    });
  }
  return { dagKop, dagdeelKop };
}

/**
 * Bouwt en downloadt de afwezigheden van de dagen die de afwezigheidsplanner toont.
 *
 * Apart van het rooster hierboven, met eigen kolommen. Het rooster erbij zou hier zes lege
 * kolommen betekenen, en dat leest als ontbrekende gegevens in plaats van als een ander scherm.
 *
 * Aangevraagd staat in een eigen kolom naast vastgelegd, niet als een aparte soort. Wie telt
 * hoeveel dagdelen er vastliggen moet de aanvragen eruit kunnen filteren; wie kijkt of iemand er
 * is wil ze juist zien staan.
 *
 * Afwezigheden op een dagdeel waarop de dokter niet inroosterbaar is staan er gewoon in. Die
 * verschenen hier eerder wel en op het scherm niet, wat het bestand als enige liet zien dat er
 * saldo verdween aan onzichtbare regels. Sinds het raster ze ook toont is dat geen verschil meer.
 */
export async function downloadPlannerAfwezigheden(params: {
  bestandsnaam: string;
  kop: string;
  datums: string[];
  dagdelen: RoosterExportDagdeel[];
  deelnemers: RoosterExportDeelnemer[];
  absences: PraktijkplannerAbsenceSlot[];
}): Promise<void> {
  const absentieOp = new Map(
    params.absences.map((slot) => [sleutel(slot.iddeelnemer, slot.datum, slot.iddagdeel), slot])
  );

  const gegevens: ExcelWaarde[][] = [];
  const raster: ExcelWaarde[][] = [];

  for (const deelnemer of params.deelnemers) {
    const rasterRegel: ExcelWaarde[] = [deelnemer.naam];
    for (const datum of params.datums) {
      for (const dagdeel of params.dagdelen) {
        const absentie = absentieOp.get(sleutel(deelnemer.id, datum, dagdeel.id));
        rasterRegel.push(
          absentie
            ? absentie.isVoorlopig
              ? `${absentie.absenceType.naam} (aangevraagd)`
              : absentie.absenceType.naam
            : ''
        );
        if (!absentie) continue;
        gegevens.push([
          new Date(`${datum}T12:00:00`),
          weekdagNaam(datum),
          dagdeel.naam,
          deelnemer.naam,
          absentie.absenceType.naam,
          absentie.isVoorlopig ? 'aangevraagd' : 'vastgelegd',
        ]);
      }
    }
    raster.push(rasterRegel);
  }

  gegevens.sort((links, rechts) => {
    const datumVerschil = (links[0] as Date).getTime() - (rechts[0] as Date).getTime();
    if (datumVerschil !== 0) return datumVerschil;
    return String(links[3]).localeCompare(String(rechts[3]), 'nl');
  });

  const { dagKop, dagdeelKop } = rasterKoppen(params.datums, params.dagdelen);

  await downloadWerkboek(params.bestandsnaam, [
    {
      naam: 'Gegevens',
      kolombreedtes: [12, 12, 14, 28, 24, 18],
      dagKolommen: [0],
      rijen: [
        [params.kop],
        [],
        ['Datum', 'Weekdag', 'Dagdeel', 'Dokter', 'Afwezigheid', 'Status'],
        ...gegevens,
      ],
    },
    {
      naam: 'Overzicht',
      kolombreedtes: [28, ...Array(params.datums.length * params.dagdelen.length).fill(18)],
      rijen: [[params.kop], [], dagKop, dagdeelKop, ...raster],
    },
  ]);
}

/**
 * Bouwt en downloadt het rooster van de praktijkplanner voor de dagen die het scherm toont.
 *
 * Twee bladen, en ze zijn er allebei om een andere reden. Gegevens zet elk dagdeel op een eigen
 * regel, met activiteit, specificatie, locatie en taken elk in een eigen kolom: dat is de vorm
 * waar een draaitabel of een filter iets mee kan, en de vorm waarin twee weken naast elkaar te
 * leggen zijn. Weekoverzicht zet dezelfde gegevens in het raster van het scherm, want wie het
 * uitprint of doorstuurt wil het herkennen.
 *
 * Alleen gevulde dagdelen komen op het blad Gegevens. Een lege regel per dokter per dagdeel zou
 * het bestand een paar honderd regels groter maken zonder iets te vertellen; het raster ernaast
 * laat de gaten wel zien.
 */
export async function downloadPlannerRooster(params: {
  bestandsnaam: string;
  kop: string;
  datums: string[];
  dagdelen: RoosterExportDagdeel[];
  deelnemers: RoosterExportDeelnemer[];
  slots: PraktijkplannerPlanningSlot[];
  absences: PraktijkplannerAbsenceSlot[];
}): Promise<void> {
  const slotOp = new Map(
    params.slots.map((slot) => [sleutel(slot.iddeelnemer, slot.datum, slot.iddagdeel), slot])
  );
  const absentieOp = new Map(
    params.absences.map((slot) => [sleutel(slot.iddeelnemer, slot.datum, slot.iddagdeel), slot])
  );

  const gegevens: ExcelWaarde[][] = [];
  const raster: ExcelWaarde[][] = [];

  for (const deelnemer of params.deelnemers) {
    const rasterRegel: ExcelWaarde[] = [deelnemer.naam];
    for (const datum of params.datums) {
      for (const dagdeel of params.dagdelen) {
        const key = sleutel(deelnemer.id, datum, dagdeel.id);
        const slot = slotOp.get(key);
        const absentie = absentieOp.get(key);
        rasterRegel.push(vakjeTekst(slot, absentie));
        if (!slot && !absentie) continue;
        gegevens.push([
          new Date(`${datum}T12:00:00`),
          weekdagNaam(datum),
          dagdeel.naam,
          deelnemer.naam,
          slot ? activiteitTekst(slot) : '',
          slot?.specification?.naam ?? '',
          slot?.location?.naam ?? '',
          slot ? takenTekst(slot) : '',
          slot?.availability?.naam ?? '',
          absentie ? absentie.absenceType.naam : '',
          absentie ? (absentie.isVoorlopig ? 'aangevraagd' : 'vastgelegd') : '',
          slot?.recurrenceId != null ? 'ja' : '',
        ]);
      }
    }
    raster.push(rasterRegel);
  }

  gegevens.sort((links, rechts) => {
    const datumVerschil = (links[0] as Date).getTime() - (rechts[0] as Date).getTime();
    if (datumVerschil !== 0) return datumVerschil;
    return String(links[3]).localeCompare(String(rechts[3]), 'nl');
  });

  const { dagKop, dagdeelKop } = rasterKoppen(params.datums, params.dagdelen);

  const bladen: ExcelBlad[] = [
    {
      naam: 'Gegevens',
      kolombreedtes: [12, 12, 14, 28, 24, 24, 24, 30, 20, 20, 18, 14],
      dagKolommen: [0],
      rijen: [
        [params.kop],
        [],
        [
          'Datum',
          'Weekdag',
          'Dagdeel',
          'Dokter',
          'Activiteit',
          'Specificatie',
          'Locatie',
          'Taken',
          'Beschikbaarheid',
          'Afwezigheid',
          'Status afwezigheid',
          'Uit herhaling',
        ],
        ...gegevens,
      ],
    },
    {
      naam: 'Weekoverzicht',
      kolombreedtes: [28, ...Array(params.datums.length * params.dagdelen.length).fill(18)],
      rijen: [[params.kop], [], dagKop, dagdeelKop, ...raster],
    },
  ];

  await downloadWerkboek(params.bestandsnaam, bladen);
}
