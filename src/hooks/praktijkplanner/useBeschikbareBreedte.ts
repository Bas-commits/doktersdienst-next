'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Vanaf hoeveel pixels twee panelen naast elkaar passen.
 *
 * Het weekrooster heeft minimaal 160 pixels voor de namen en 128 per dag, dus met zeven dagen
 * 1056. Het capaciteitsoverzicht wil er minimaal 500 om nog leesbaar te zijn, plus de ruimte
 * tussen de twee. Onder de 1600 wordt het weekrooster zo smal dat je er niet meer in kunt
 * plannen, en dan is naast elkaar zetten geen winst maar verlies.
 *
 * Dit getal staat expres los, zodat het in een regel te verschuiven is als het in de praktijk
 * tegenvalt.
 */
export const PANEEL_DREMPEL_PX = 1600;

/** Wat het palet Dagdeel samenstellen inneemt, plus de ruimte ernaast. */
export const PALET_BREEDTE_PX = 256;

/**
 * De smalste week waar nog in te plannen is: 160 pixels voor de namen en 128 per dag.
 *
 * Staat er een paneel naast, dan krijgen week en paneel allebei de helft, maar niet ten koste
 * van de week. Op de drempel van 1600 is de helft maar 792, en daar past het rooster niet in.
 * Dit getal is de bodem: eerst de week zijn minimum, de rest is voor het paneel.
 */
export const WEEK_MINIMUM_PX = 1056;

/**
 * De breedte van een blok, bijgehouden terwijl het scherm verandert.
 *
 * Meet de ruimte die het rooster echt krijgt, niet de breedte van het venster. De zijbalk
 * staat ernaast en gaat van diezelfde ruimte af, dus een venster van 1920 zegt op zichzelf
 * niets.
 *
 * Meet een blok waarvan de breedte niet van de uitkomst afhangt. Zou hier het blok gemeten
 * worden waar het palet in staat, dan verbergt een smal scherm het palet, wordt het blok
 * daardoor breder, past het ineens wel, komt het palet terug, en flikkert het scherm heen en
 * weer. Trek de breedte van het palet er daarom achteraf af met PALET_BREEDTE_PX.
 *
 * Args:
 *     blok: Het element dat gemeten wordt. Begint op 0 tot de eerste meting binnen is, dus
 *         een scherm start altijd zonder paneel en niet met een paneel dat meteen weer weg
 *         springt.
 */
export function useBeschikbareBreedte(blok: RefObject<HTMLElement | null>): number {
  const [breedte, setBreedte] = useState(0);

  useEffect(() => {
    const element = blok.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const meet = () => setBreedte(element.getBoundingClientRect().width);
    meet();

    const observer = new ResizeObserver(meet);
    observer.observe(element);
    return () => observer.disconnect();
  }, [blok]);

  return breedte;
}
