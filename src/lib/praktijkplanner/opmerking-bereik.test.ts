import { describe, expect, it } from 'vitest';
import {
  isOpmerkingBereik,
  kiesOpmerkingDoelen,
  type OpmerkingReeksFiche,
} from './opmerking-bereik';

// Een reeks van drie weken, elke week dinsdag ochtend/middag en vrijdag ochtend.
const reeks: OpmerkingReeksFiche[] = [
  { idplanning: 1, datum: '2026-08-25', iddagdeel: 1 },
  { idplanning: 2, datum: '2026-08-25', iddagdeel: 2 },
  { idplanning: 3, datum: '2026-08-28', iddagdeel: 1 },
  { idplanning: 4, datum: '2026-09-01', iddagdeel: 1 },
  { idplanning: 5, datum: '2026-09-01', iddagdeel: 2 },
  { idplanning: 6, datum: '2026-09-04', iddagdeel: 1 },
  { idplanning: 7, datum: '2026-09-08', iddagdeel: 1 },
  { idplanning: 8, datum: '2026-09-08', iddagdeel: 2 },
  { idplanning: 9, datum: '2026-09-11', iddagdeel: 1 },
];

const bron: OpmerkingReeksFiche = { idplanning: 4, datum: '2026-09-01', iddagdeel: 1 };

describe('kiesOpmerkingDoelen', () => {
  it('raakt bij "alleen dit fiche" niets anders aan', () => {
    expect(
      kiesOpmerkingDoelen({ bereik: 'fiche', bron, reeks, ookEerdereWeken: true })
    ).toEqual([4]);
  });

  it('pakt bij "dit dagdeel" dezelfde weekdag en hetzelfde dagdeel, vanaf deze datum', () => {
    expect(
      kiesOpmerkingDoelen({ bereik: 'dagdeel', bron, reeks, ookEerdereWeken: false })
    ).toEqual([4, 7]);
  });

  it('neemt met "ook eerdere weken" ook de weken voor deze datum mee', () => {
    expect(
      kiesOpmerkingDoelen({ bereik: 'dagdeel', bron, reeks, ookEerdereWeken: true })
    ).toEqual([1, 4, 7]);
  });

  it('pakt bij "deze hele dag" alle dagdelen van die weekdag', () => {
    expect(
      kiesOpmerkingDoelen({ bereik: 'dag', bron, reeks, ookEerdereWeken: true })
    ).toEqual([1, 2, 4, 5, 7, 8]);
  });

  it('pakt bij "alle fiches" ook de andere weekdagen van de reeks', () => {
    expect(
      kiesOpmerkingDoelen({ bereik: 'reeks', bron, reeks, ookEerdereWeken: true })
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('laat bij "alle fiches" zonder eerdere weken het verleden staan', () => {
    expect(
      kiesOpmerkingDoelen({ bereik: 'reeks', bron, reeks, ookEerdereWeken: false })
    ).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it('houdt de aangeklikte fiche erbij als de reeks leeg is', () => {
    expect(
      kiesOpmerkingDoelen({ bereik: 'reeks', bron, reeks: [], ookEerdereWeken: true })
    ).toEqual([4]);
  });

  it('herkent alleen de vier bekende keuzes', () => {
    expect(isOpmerkingBereik('dagdeel')).toBe(true);
    expect(isOpmerkingBereik('week')).toBe(false);
    expect(isOpmerkingBereik(undefined)).toBe(false);
  });
});
