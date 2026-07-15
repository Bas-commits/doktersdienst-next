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
