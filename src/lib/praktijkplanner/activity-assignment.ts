export type ActivityAssignmentSelection = {
  activityId: number | null;
  specificationId: number | null;
  taskIds: number[];
  locationId: number | null;
  availabilityId: number | null;
};

export type CurrentActivityAssignment = {
  idactiviteit: number | null;
  idactiviteitspecificatie: number | null;
  idplannerlocatie: number | null;
  idbeschikbaarheidstype: number | null;
  taskIds: number[];
  version: number | null;
};

export type PendingActivityAssignment = CurrentActivityAssignment & {
  iddeelnemer: number;
  datum: string;
  iddagdeel: number;
};

export function hasActivityAssignmentSelection(selection: ActivityAssignmentSelection) {
  return (
    selection.activityId != null ||
    selection.locationId != null ||
    selection.availabilityId != null ||
    selection.taskIds.length > 0
  );
}

export function missingActivityExpertiseMessage(expertiseNaam: string, activityNaam: string) {
  return `Deze deelnemer beschikt niet over expertise ${expertiseNaam} welke vereist is voor activiteit ${activityNaam}`;
}

export function missingTaskExpertiseMessage(expertiseNaam: string, taskNaam: string) {
  return `Deze deelnemer beschikt niet over expertise ${expertiseNaam} welke vereist is voor taak ${taskNaam}`;
}

/** Returns a user-facing warning when the activity requires an expertise the deelnemer lacks. */
export function getMissingActivityExpertiseWarning({
  activity,
  expertises,
  participantExpertiseIds,
}: {
  activity:
    | {
        naam: string;
        idexpertise: number | null;
      }
    | null
    | undefined;
  expertises: ReadonlyArray<{ id: number; naam: string }>;
  participantExpertiseIds: ReadonlyArray<number>;
}): string | null {
  if (activity?.idexpertise == null) return null;
  if (participantExpertiseIds.includes(activity.idexpertise)) return null;
  const expertise = expertises.find((item) => item.id === activity.idexpertise);
  return missingActivityExpertiseMessage(
    expertise?.naam ?? `expertise ${activity.idexpertise}`,
    activity.naam
  );
}

/** Returns warnings for selected tasks that require an expertise the deelnemer lacks. */
export function getMissingTaskExpertiseWarnings({
  tasks,
  expertises,
  participantExpertiseIds,
}: {
  tasks: ReadonlyArray<{
    afkorting: string | null;
    omschrijving: string | null;
    idexpertise: number | null;
  }>;
  expertises: ReadonlyArray<{ id: number; naam: string }>;
  participantExpertiseIds: ReadonlyArray<number>;
}): string[] {
  const warnings: string[] = [];
  for (const task of tasks) {
    if (task.idexpertise == null) continue;
    if (participantExpertiseIds.includes(task.idexpertise)) continue;
    const expertise = expertises.find((item) => item.id === task.idexpertise);
    const taskNaam = task.afkorting?.trim() || task.omschrijving?.trim() || 'taak';
    warnings.push(
      missingTaskExpertiseMessage(
        expertise?.naam ?? `expertise ${task.idexpertise}`,
        taskNaam
      )
    );
  }
  return warnings;
}

function hasCombinedDaypartSelection(selection: ActivityAssignmentSelection) {
  return selection.activityId != null || selection.locationId != null || selection.taskIds.length > 0;
}

export function buildActivityAssignmentSlot({
  participantId,
  date,
  daypartId,
  selection,
  current,
  clearMode,
}: {
  participantId: number;
  date: string;
  daypartId: number;
  selection: ActivityAssignmentSelection;
  current: CurrentActivityAssignment | null;
  clearMode: boolean;
}): PendingActivityAssignment {
  if (clearMode) {
    return {
      iddeelnemer: participantId,
      datum: date,
      iddagdeel: daypartId,
      idactiviteit: null,
      idactiviteitspecificatie: null,
      idplannerlocatie: null,
      idbeschikbaarheidstype: null,
      taskIds: [],
      version: current?.version ?? null,
    };
  }

  const replaceCombinedDaypart = hasCombinedDaypartSelection(selection);

  return {
    iddeelnemer: participantId,
    datum: date,
    iddagdeel: daypartId,
    idactiviteit: replaceCombinedDaypart ? selection.activityId : current?.idactiviteit ?? null,
    idactiviteitspecificatie: replaceCombinedDaypart
      ? selection.activityId == null
        ? null
        : selection.specificationId
      : current?.idactiviteitspecificatie ?? null,
    idplannerlocatie: replaceCombinedDaypart ? selection.locationId : current?.idplannerlocatie ?? null,
    idbeschikbaarheidstype: selection.availabilityId ?? current?.idbeschikbaarheidstype ?? null,
    taskIds: replaceCombinedDaypart ? selection.taskIds : current?.taskIds ?? [],
    version: current?.version ?? null,
  };
}
