import { downloadWerkboek } from '@/lib/excel-export';

export type VakantieRegel = {
  id: number;
  regio: string;
  naam: string;
  van: number;
  tot: number;
  type: string;
};

/**
 * Bouwt en downloadt de vakanties en feestdagen van een jaar.
 *
 * Een blad, want deze tabel is de gegevens; er valt niets samen te vatten dat het scherm niet al
 * toont. De begin- en eindtijd gaan mee met de tijd erbij: een vakantie loopt tot 23:59 en een
 * feestdag beslaat soms een halve dag, en dat verschil verdwijnt als je op de dag afrondt.
 *
 * De id gaat mee omdat hij op het scherm ook staat. Wie een vakantie meldt die verkeerd staat,
 * kan er zo naar verwijzen.
 */
export async function downloadVakanties(params: {
  bestandsnaam: string;
  jaar: number;
  regels: VakantieRegel[];
}): Promise<void> {
  await downloadWerkboek(params.bestandsnaam, [
    {
      naam: 'Vakanties',
      kolombreedtes: [8, 24, 32, 18, 18, 14],
      rijen: [
        [`Vakanties en feestdagen ${params.jaar}`],
        [],
        ['ID', 'Regio', 'Naam', 'Van', 'Tot', 'Type'],
        ...params.regels.map((regel) => [
          regel.id,
          regel.regio,
          regel.naam,
          new Date(regel.van * 1000),
          new Date(regel.tot * 1000),
          regel.type,
        ]),
      ],
    },
  ]);
}
