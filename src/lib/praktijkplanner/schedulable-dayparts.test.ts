import { describe, expect, it } from 'vitest';
import {
  dagdelenZonderRooster,
  defaultAllSchedulable,
  isDaypartSchedulable,
  isDaypartSchedulableForParticipant,
  isoWeekdayFromDate,
  resolveParticipantMatrixForEditor,
  resolveSchedulableMatrixForEditor,
  weekdagenZonderRooster,
} from '@/lib/praktijkplanner/schedulable-dayparts';

describe('schedulable-dayparts', () => {
  it('treats an empty matrix as fully schedulable', () => {
    expect(isDaypartSchedulable([], '2026-07-20', 4)).toBe(true);
    expect(isDaypartSchedulable([], 7, 1)).toBe(true);
  });

  it('maps ISO dates to Monday=1 … Sunday=7', () => {
    expect(isoWeekdayFromDate('2026-07-20')).toBe(1); // Monday
    expect(isoWeekdayFromDate('2026-07-26')).toBe(7); // Sunday
  });

  it('respects explicit actief=false rows', () => {
    const matrix = [
      { weekdag: 6, iddagdeel: 1, actief: true },
      { weekdag: 6, iddagdeel: 2, actief: true },
      { weekdag: 6, iddagdeel: 3, actief: true },
      { weekdag: 6, iddagdeel: 4, actief: false },
      { weekdag: 7, iddagdeel: 1, actief: false },
    ];
    expect(isDaypartSchedulable(matrix, 6, 3)).toBe(true);
    expect(isDaypartSchedulable(matrix, 6, 4)).toBe(false);
    expect(isDaypartSchedulable(matrix, '2026-07-25', 4)).toBe(false); // Saturday
    expect(isDaypartSchedulable(matrix, '2026-07-26', 1)).toBe(false); // Sunday
    // Missing weekday×daypart in a non-empty matrix is not schedulable
    expect(isDaypartSchedulable(matrix, 1, 1)).toBe(false);
  });

  it('builds a full active default matrix for the editor', () => {
    const defaults = defaultAllSchedulable([1, 2, 3, 4]);
    expect(defaults).toHaveLength(28);
    expect(defaults.every((cell) => cell.actief)).toBe(true);
  });

  it('fills missing cells as inactive when stored matrix exists', () => {
    const resolved = resolveSchedulableMatrixForEditor(
      [{ weekdag: 1, iddagdeel: 1, actief: true }],
      [1, 2]
    );
    expect(resolved).toHaveLength(14);
    expect(resolved.find((cell) => cell.weekdag === 1 && cell.iddagdeel === 1)?.actief).toBe(true);
    expect(resolved.find((cell) => cell.weekdag === 1 && cell.iddagdeel === 2)?.actief).toBe(false);
    expect(resolved.find((cell) => cell.weekdag === 7 && cell.iddagdeel === 1)?.actief).toBe(false);
  });

  it('inherits group availability when participant matrix is empty', () => {
    const group = [{ weekdag: 1, iddagdeel: 1, actief: true }];
    expect(isDaypartSchedulableForParticipant(group, [], 1, 1)).toBe(true);
    expect(isDaypartSchedulableForParticipant(group, [], 1, 2)).toBe(false);
  });

  it('applies participant override within group possibilities', () => {
    const group = [
      { weekdag: 1, iddagdeel: 1, actief: true },
      { weekdag: 1, iddagdeel: 2, actief: true },
    ];
    const participant = [
      { weekdag: 1, iddagdeel: 1, actief: true },
      { weekdag: 1, iddagdeel: 2, actief: false },
    ];
    expect(isDaypartSchedulableForParticipant(group, participant, 1, 1)).toBe(true);
    expect(isDaypartSchedulableForParticipant(group, participant, 1, 2)).toBe(false);
    // Group off always wins
    expect(
      isDaypartSchedulableForParticipant(
        [{ weekdag: 1, iddagdeel: 1, actief: false }],
        [{ weekdag: 1, iddagdeel: 1, actief: true }],
        1,
        1
      )
    ).toBe(false);
  });

  it('resolves participant editor matrix from group + override', () => {
    const group = defaultAllSchedulable([1, 2]);
    const sundayMorning = group.find((cell) => cell.weekdag === 7 && cell.iddagdeel === 1);
    if (sundayMorning) sundayMorning.actief = false;
    const resolved = resolveParticipantMatrixForEditor(
      group,
      [{ weekdag: 1, iddagdeel: 1, actief: false }],
      [1, 2]
    );
    expect(resolved.find((cell) => cell.weekdag === 1 && cell.iddagdeel === 1)?.actief).toBe(false);
    expect(resolved.find((cell) => cell.weekdag === 7 && cell.iddagdeel === 1)?.actief).toBe(false);
  });
});

describe('weekdagen en dagdelen zonder rooster', () => {
  // Een groep die alleen op maandag en dinsdag werkt, en dan alleen ochtend en middag.
  const matrix = [1, 2].flatMap((weekdag) =>
    [1, 2].map((iddagdeel) => ({ weekdag, iddagdeel, actief: true }))
  );
  const leeg = new Set<number>();

  it('laat niets weg zolang er geen matrix is opgeslagen', () => {
    expect([...weekdagenZonderRooster([], leeg)]).toEqual([]);
    expect([...dagdelenZonderRooster([], [1, 2, 3, 4], leeg)]).toEqual([]);
  });

  it('haalt de dagen weg waarop de groep nooit werkt', () => {
    expect([...weekdagenZonderRooster(matrix, leeg)]).toEqual([3, 4, 5, 6, 7]);
  });

  it('haalt de dagdelen weg die op geen enkele dag gebruikt worden', () => {
    expect([...dagdelenZonderRooster(matrix, [1, 2, 3, 4], leeg)]).toEqual([3, 4]);
  });

  it('houdt een dag in beeld zodra er toch iets in staat', () => {
    // Zonder deze uitzondering is die woensdag niet meer te bereiken: anders dan bij avond en
    // nacht is er geen knop om de kolom terug te halen.
    expect([...weekdagenZonderRooster(matrix, new Set([3]))]).toEqual([4, 5, 6, 7]);
  });

  it('houdt een dagdeel in beeld zodra er toch iets in staat', () => {
    expect([...dagdelenZonderRooster(matrix, [1, 2, 3, 4], new Set([4]))]).toEqual([3]);
  });

  it('telt een dag met alleen uitgezette rijen ook als nooit gebruikt', () => {
    const uitgezet = [
      { weekdag: 1, iddagdeel: 1, actief: true },
      { weekdag: 6, iddagdeel: 1, actief: false },
    ];
    expect(weekdagenZonderRooster(uitgezet, leeg).has(6)).toBe(true);
  });
});
