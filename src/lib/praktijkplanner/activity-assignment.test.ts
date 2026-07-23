import { describe, expect, it } from 'vitest';
import {
  buildActivityAssignmentSlot,
  getMissingActivityExpertiseWarning,
  getMissingTaskExpertiseWarnings,
  hasActivityAssignmentSelection,
  missingActivityExpertiseMessage,
  missingTaskExpertiseMessage,
  type ActivityAssignmentSelection,
} from './activity-assignment';

const existingSlot = {
  idactiviteit: 1,
  idactiviteitspecificatie: 2,
  idplannerlocatie: 3,
  idbeschikbaarheidstype: 4,
  taskIds: [5],
  version: 6,
};

const emptySelection: ActivityAssignmentSelection = {
  activityId: null,
  specificationId: null,
  taskIds: [],
  locationId: null,
  availabilityId: null,
};

describe('buildActivityAssignmentSlot', () => {
  it('replaces the full combined daypart with the selected activity, tasks, and location', () => {
    const assignment = buildActivityAssignmentSlot({
      participantId: 7,
      date: '2026-07-15',
      daypartId: 8,
      current: existingSlot,
      clearMode: false,
      selection: {
        activityId: 10,
        specificationId: 11,
        taskIds: [12, 13],
        locationId: 14,
        availabilityId: null,
      },
    });

    expect(assignment).toEqual({
      iddeelnemer: 7,
      datum: '2026-07-15',
      iddagdeel: 8,
      idactiviteit: 10,
      idactiviteitspecificatie: 11,
      idplannerlocatie: 14,
      idbeschikbaarheidstype: 4,
      taskIds: [12, 13],
      version: 6,
    });
  });

  it('clears omitted activity, task, and location values when stamping a partial combination', () => {
    const assignment = buildActivityAssignmentSlot({
      participantId: 7,
      date: '2026-07-15',
      daypartId: 8,
      current: existingSlot,
      clearMode: false,
      selection: {
        ...emptySelection,
        activityId: 10,
      },
    });

    expect(assignment).toMatchObject({
      idactiviteit: 10,
      idactiviteitspecificatie: null,
      idplannerlocatie: null,
      taskIds: [],
      idbeschikbaarheidstype: 4,
    });
  });

  it('updates availability without replacing an existing combined daypart', () => {
    const assignment = buildActivityAssignmentSlot({
      participantId: 7,
      date: '2026-07-15',
      daypartId: 8,
      current: existingSlot,
      clearMode: false,
      selection: {
        ...emptySelection,
        availabilityId: 9,
      },
    });

    expect(assignment).toMatchObject({
      ...existingSlot,
      idbeschikbaarheidstype: 9,
    });
  });

  it('can stamp the same combination into multiple dayparts', () => {
    const selection: ActivityAssignmentSelection = {
      activityId: 10,
      specificationId: 11,
      taskIds: [12],
      locationId: 13,
      availabilityId: null,
    };
    const firstAssignment = buildActivityAssignmentSlot({
      participantId: 7,
      date: '2026-07-15',
      daypartId: 8,
      current: null,
      clearMode: false,
      selection,
    });
    const secondAssignment = buildActivityAssignmentSlot({
      participantId: 7,
      date: '2026-07-16',
      daypartId: 9,
      current: null,
      clearMode: false,
      selection,
    });

    expect(firstAssignment).toMatchObject({
      datum: '2026-07-15',
      iddagdeel: 8,
      idactiviteit: 10,
      idactiviteitspecificatie: 11,
      idplannerlocatie: 13,
      taskIds: [12],
    });
    expect(secondAssignment).toMatchObject({
      datum: '2026-07-16',
      iddagdeel: 9,
      idactiviteit: 10,
      idactiviteitspecificatie: 11,
      idplannerlocatie: 13,
      taskIds: [12],
    });
    expect(selection.taskIds).toEqual([12]);
  });

  it('empties every daypart value in clear mode', () => {
    const assignment = buildActivityAssignmentSlot({
      participantId: 7,
      date: '2026-07-15',
      daypartId: 8,
      current: existingSlot,
      clearMode: true,
      selection: emptySelection,
    });

    expect(assignment).toMatchObject({
      idactiviteit: null,
      idactiviteitspecificatie: null,
      idplannerlocatie: null,
      idbeschikbaarheidstype: null,
      taskIds: [],
      version: 6,
    });
  });

  it('recognizes every selectable assignment category', () => {
    expect(hasActivityAssignmentSelection(emptySelection)).toBe(false);
    expect(hasActivityAssignmentSelection({ ...emptySelection, taskIds: [5] })).toBe(true);
    expect(hasActivityAssignmentSelection({ ...emptySelection, availabilityId: 4 })).toBe(true);
  });
});

describe('getMissingActivityExpertiseWarning', () => {
  const expertises = [
    { id: 1, naam: 'Spoedzorg' },
    { id: 2, naam: 'Visite' },
  ];

  it('returns null when the activity has no required expertise', () => {
    expect(
      getMissingActivityExpertiseWarning({
        activity: { naam: 'Balie', idexpertise: null },
        expertises,
        participantExpertiseIds: [],
      })
    ).toBeNull();
  });

  it('returns null when the deelnemer has the required expertise', () => {
    expect(
      getMissingActivityExpertiseWarning({
        activity: { naam: 'Spoed', idexpertise: 1 },
        expertises,
        participantExpertiseIds: [1, 2],
      })
    ).toBeNull();
  });

  it('returns a warning when the required expertise is missing', () => {
    expect(
      getMissingActivityExpertiseWarning({
        activity: { naam: 'Spoed', idexpertise: 1 },
        expertises,
        participantExpertiseIds: [2],
      })
    ).toBe(missingActivityExpertiseMessage('Spoedzorg', 'Spoed'));
  });
});

describe('getMissingTaskExpertiseWarnings', () => {
  const expertises = [
    { id: 1, naam: 'Spoedzorg' },
    { id: 2, naam: 'Visite' },
  ];

  it('returns warnings only for tasks with a missing required expertise', () => {
    expect(
      getMissingTaskExpertiseWarnings({
        tasks: [
          { afkorting: 'HV', omschrijving: 'Huisvisite', idexpertise: 2 },
          { afkorting: 'SP', omschrijving: 'Spoed', idexpertise: 1 },
          { afkorting: 'ALG', omschrijving: 'Algemeen', idexpertise: null },
        ],
        expertises,
        participantExpertiseIds: [2],
      })
    ).toEqual([missingTaskExpertiseMessage('Spoedzorg', 'SP')]);
  });
});
