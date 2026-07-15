'use client';

import Image from 'next/image';
import { Check, ChevronDown, ChevronUp, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { activiteitenIconPath } from '@/lib/praktijkplanner/activiteiten-iconen';
import type {
  PraktijkplannerActivity,
  PraktijkplannerActivitySpecification,
  PraktijkplannerAvailabilityType,
  PraktijkplannerLocation,
  PraktijkplannerTaskType,
} from '@/types/praktijkplanner';

type BuilderSectionId = 'activities' | 'tasks' | 'locations' | 'availability';

type Selection = {
  activityId: number | null;
  specificationId: number | null;
  taskIds: number[];
  locationId: number | null;
  availabilityId: number | null;
};

type BuilderSectionProps = {
  id: BuilderSectionId;
  title: string;
  selectedCount: number;
  isOpen: boolean;
  onToggle: () => void;
  onClear?: () => void;
  children: React.ReactNode;
};

function sectionCheckboxClass(selected: boolean) {
  return [
    'flex size-4 shrink-0 items-center justify-center rounded border',
    selected
      ? 'border-[#c91b23] bg-[#c91b23] text-white'
      : 'border-input bg-background text-transparent',
  ].join(' ');
}

function SelectionIndicator({
  selected,
  type,
}: {
  selected: boolean;
  type: 'checkbox' | 'radio';
}) {
  return (
    <span
      className={[
        'flex size-4 shrink-0 items-center justify-center border transition-colors',
        type === 'radio' ? 'rounded-full' : 'rounded',
        selected
          ? 'border-[#c91b23] bg-[#c91b23] text-white'
          : 'border-input bg-background text-transparent',
      ].join(' ')}
      aria-hidden
    >
      {selected ? <Check className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

function BuilderSection({
  id,
  title,
  selectedCount,
  isOpen,
  onToggle,
  onClear,
  children,
}: BuilderSectionProps) {
  const contentId = `activity-assignment-${id}`;

  return (
    <section className="border-t pt-2 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left text-sm font-semibold hover:bg-muted"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={onToggle}
        >
          <span className={sectionCheckboxClass(selectedCount > 0)} aria-hidden>
            {selectedCount > 0 ? <Check className="size-3" strokeWidth={3} /> : null}
          </span>
          <span className="truncate">{title}</span>
          {selectedCount > 0 ? (
            <span className="ml-auto rounded-full bg-[#c91b23] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {selectedCount}
            </span>
          ) : null}
          {isOpen ? <ChevronUp className="size-4 shrink-0" aria-hidden /> : <ChevronDown className="size-4 shrink-0" aria-hidden />}
        </button>
        {selectedCount > 0 && onClear ? (
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClear}
            aria-label={`${title} wissen`}
            title={`${title} wissen`}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {isOpen ? (
        <div id={contentId} className="mt-1 space-y-1.5 px-1 pb-1">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function OptionPreview({
  color,
  label,
  icon,
  slot = 'middle',
}: {
  color: string | null;
  label: string;
  icon?: string | null;
  slot?: 'top' | 'middle' | 'bottom';
}) {
  const coloredRow = (
    <span
      className="flex flex-1 w-full items-center justify-center"
      style={{ backgroundColor: color || '#e5e7eb' }}
    >
      {icon ? (
        <span className="flex h-5 items-center justify-center">
          <Image
            src={icon}
            alt=""
            width={17}
            height={17}
            className="py-0.5 object-contain"
            style={{ filter: 'invert(1) brightness(2)' }}
          />
          {label ? (
            <span className="ml-0.5 w-full truncate overflow-hidden whitespace-nowrap px-0.5 text-[12px] font-semibold text-white">
              {label}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="px-1 text-[9px] text-white">{label}</span>
      )}
    </span>
  );
  const neutralRow = <span className="flex-1 w-full bg-neutral-300" />;

  const rows =
    slot === 'top'
      ? [coloredRow, neutralRow, neutralRow]
      : slot === 'bottom'
        ? [neutralRow, neutralRow, coloredRow]
        : [neutralRow, coloredRow, neutralRow];

  return (
    <span
      className="flex h-12 w-18 shrink-0 flex-col overflow-hidden rounded-md text-center text-[9px] font-semibold leading-tight"
      aria-hidden
    >
      {rows}
    </span>
  );
}

function ChipPreview({
  color,
  children,
}: {
  color: string | null;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
      style={{ backgroundColor: color || '#64748b' }}
    >
      {children}
    </span>
  );
}

export function PlannerActivityAssignmentBuilder({
  activities,
  specifications,
  tasks,
  locations,
  availabilityTypes,
  selection,
  clearMode,
  onActivityChange,
  onSpecificationChange,
  onTaskChange,
  onLocationChange,
  onAvailabilityChange,
  onClearSelection,
  onClearModeChange,
}: {
  activities: PraktijkplannerActivity[];
  specifications: PraktijkplannerActivitySpecification[];
  tasks: PraktijkplannerTaskType[];
  locations: PraktijkplannerLocation[];
  availabilityTypes: PraktijkplannerAvailabilityType[];
  selection: Selection;
  clearMode: boolean;
  onActivityChange: (id: number | null) => void;
  onSpecificationChange: (id: number | null) => void;
  onTaskChange: (ids: number[]) => void;
  onLocationChange: (id: number | null) => void;
  onAvailabilityChange: (id: number | null) => void;
  onClearSelection: () => void;
  onClearModeChange: (enabled: boolean) => void;
}) {
  const [openSections, setOpenSections] = useState<Record<BuilderSectionId, boolean>>({
    activities: true,
    tasks: true,
    locations: true,
    availability: false,
  });
  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id === selection.activityId) ?? null,
    [activities, selection.activityId]
  );
  const selectedSpecification = useMemo(
    () => specifications.find((specification) => specification.id === selection.specificationId) ?? null,
    [selection.specificationId, specifications]
  );
  const selectedTasks = useMemo(
    () => selection.taskIds.flatMap((id) => tasks.find((task) => task.id === id) ?? []),
    [selection.taskIds, tasks]
  );
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selection.locationId) ?? null,
    [locations, selection.locationId]
  );
  const selectedAvailability = useMemo(
    () => availabilityTypes.find((availability) => availability.id === selection.availabilityId) ?? null,
    [availabilityTypes, selection.availabilityId]
  );
  const selectedSpecifications = useMemo(
    () => specifications.filter((specification) => specification.idactiviteit === selection.activityId),
    [selection.activityId, specifications]
  );
  const hasSelection =
    selection.activityId != null ||
    selection.taskIds.length > 0 ||
    selection.locationId != null ||
    selection.availabilityId != null;

  const toggleSection = (id: BuilderSectionId) => {
    setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  };

  const selectActivity = (id: number) => {
    onClearModeChange(false);
    onActivityChange(selection.activityId === id ? null : id);
  };

  const selectSpecification = (id: number) => {
    onClearModeChange(false);
    onSpecificationChange(selection.specificationId === id ? null : id);
  };

  const toggleTask = (id: number) => {
    onClearModeChange(false);
    if (selection.taskIds.includes(id)) {
      onTaskChange(selection.taskIds.filter((taskId) => taskId !== id));
      return;
    }
    if (selection.taskIds.length < 3) {
      onTaskChange([...selection.taskIds, id]);
    }
  };

  const selectLocation = (id: number) => {
    onClearModeChange(false);
    onLocationChange(selection.locationId === id ? null : id);
  };

  const selectAvailability = (id: number) => {
    onClearModeChange(false);
    onAvailabilityChange(selection.availabilityId === id ? null : id);
  };

  return (
    <aside
      className="max-h-[calc(100vh-2rem)] w-60 overflow-y-auto rounded-xl border bg-card p-3 shadow-sm"
      aria-label="Dagdeel samenstellen"
    >
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Dagdeel samenstellen</h2>
          {hasSelection ? (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Wis selectie
            </button>
          ) : null}
        </div>
        <div className="mt-2 min-h-12 rounded-lg bg-muted/60 p-2">
          {hasSelection ? (
            <div className="flex flex-wrap gap-1">
              {selectedActivity ? (
                <ChipPreview color={selectedActivity.kleur}>
                  {selectedActivity.afkorting || selectedActivity.naam}
                  {selectedSpecification ? ` · ${selectedSpecification.afkorting || selectedSpecification.naam}` : ''}
                </ChipPreview>
              ) : null}
              {selectedTasks.map((task) => (
                <ChipPreview key={task.id} color={task.kleur}>
                  {task.afkorting || task.omschrijving || `Taak ${task.id}`}
                </ChipPreview>
              ))}
              {selectedLocation ? (
                <ChipPreview color={selectedLocation.kleur}>
                  {selectedLocation.afkorting || selectedLocation.naam}
                </ChipPreview>
              ) : null}
              {selectedAvailability ? (
                <ChipPreview color={selectedAvailability.kleur}>
                  {selectedAvailability.code || selectedAvailability.naam}
                </ChipPreview>
              ) : null}
            </div>
          ) : (
            <p className="text-xs leading-snug text-muted-foreground">
              Kies een activiteit, taak of locatie en klik daarna op een dagdeel.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        aria-pressed={clearMode}
        onClick={() => onClearModeChange(!clearMode)}
        className={[
          'mb-2 flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs font-semibold transition',
          clearMode
            ? 'border-[#c91b23] bg-[#c91b23] text-white'
            : 'border-border hover:bg-muted',
        ].join(' ')}
      >
        <span className={clearMode ? 'text-white' : 'text-[#c91b23]'}>
          <Trash2 className="size-4" aria-hidden />
        </span>
        <span>{clearMode ? 'Leegmaken actief' : 'Dagdeel leegmaken'}</span>
      </button>

      <div className="space-y-2">
        <BuilderSection
          id="activities"
          title="Activiteiten"
          selectedCount={selection.activityId == null ? 0 : 1}
          isOpen={openSections.activities}
          onToggle={() => toggleSection('activities')}
          onClear={() => {
            onActivityChange(null);
            onSpecificationChange(null);
          }}
        >
          {activities.length > 0 ? (
            <div className="space-y-1" role="radiogroup" aria-label="Activiteiten">
              {activities.map((activity) => {
                const selected = selection.activityId === activity.id;
                const label = activity.afkorting
                  ? `${activity.afkorting} ${activity.naam}`
                  : activity.naam;
                return (
                  <button
                    key={activity.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={label}
                    onClick={() => selectActivity(activity.id)}
                    className={[
                      'flex w-full items-center gap-2 rounded-md p-1 text-left text-xs transition hover:bg-muted',
                      selected ? 'bg-muted' : '',
                    ].join(' ')}
                  >
                    <SelectionIndicator selected={selected} type="radio" />
                    <OptionPreview
                      color={activity.kleur}
                      label={activity.afkorting || activity.naam}
                      icon={activiteitenIconPath(activity.icon)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{activity.afkorting || activity.naam}</span>
                      {activity.afkorting ? <span className="block truncate text-muted-foreground">{activity.naam}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Geen activiteiten beschikbaar.</p>
          )}

          {selectedActivity && selectedSpecifications.length > 0 ? (
            <div className="ml-6 border-l pl-2">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">Specificatie</p>
              <div className="space-y-1" role="radiogroup" aria-label="Specificaties">
                {selectedSpecifications.map((specification) => {
                  const selected = selection.specificationId === specification.id;
                  const label = specification.afkorting
                    ? `${specification.afkorting} ${specification.naam}`
                    : specification.naam;
                  return (
                    <button
                      key={specification.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={label}
                      onClick={() => selectSpecification(specification.id)}
                      className={[
                        'flex w-full items-center gap-2 rounded-md p-1 text-left text-xs transition hover:bg-muted',
                        selected ? 'bg-muted' : '',
                      ].join(' ')}
                    >
                      <SelectionIndicator selected={selected} type="radio" />
                      <OptionPreview
                        color={specification.kleur || selectedActivity.kleur}
                        label={specification.afkorting || specification.naam}
                      />
                      <span className="min-w-0 truncate font-medium">
                        {specification.afkorting || specification.naam}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </BuilderSection>

        

        <BuilderSection
          id="locations"
          title="Locaties"
          selectedCount={selection.locationId == null ? 0 : 1}
          isOpen={openSections.locations}
          onToggle={() => toggleSection('locations')}
          onClear={() => onLocationChange(null)}
        >
          {locations.length > 0 ? (
            <div className="space-y-1" role="radiogroup" aria-label="Locaties">
              {locations.map((location) => {
                const selected = selection.locationId === location.id;
                const label = location.afkorting
                  ? `${location.afkorting} ${location.naam}`
                  : location.naam;
                return (
                  <button
                    key={location.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={label}
                    onClick={() => selectLocation(location.id)}
                    className={[
                      'flex w-full items-center gap-2 rounded-md p-1 text-left text-xs transition hover:bg-muted',
                      selected ? 'bg-muted' : '',
                    ].join(' ')}
                  >
                    <SelectionIndicator selected={selected} type="radio" />
                    <OptionPreview
                      color={location.kleur}
                      label={location.afkorting || location.naam}
                      slot="bottom"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{location.afkorting || location.naam}</span>
                      {location.afkorting ? <span className="block truncate text-muted-foreground">{location.naam}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Geen locaties beschikbaar.</p>
          )}
        </BuilderSection>

        <BuilderSection
          id="tasks"
          title="Taken"
          selectedCount={selection.taskIds.length}
          isOpen={openSections.tasks}
          onToggle={() => toggleSection('tasks')}
          onClear={() => onTaskChange([])}
        >
          <p className="text-[11px] text-muted-foreground">Kies maximaal drie taken.</p>
          {tasks.length > 0 ? (
            <div className="space-y-1">
              {tasks.map((task) => {
                const selected = selection.taskIds.includes(task.id);
                const maxSelected = !selected && selection.taskIds.length >= 3;
                const label =
                  task.afkorting && task.omschrijving
                    ? `${task.afkorting} ${task.omschrijving}`
                    : task.afkorting || task.omschrijving || `Taak ${task.id}`;
                return (
                  <button
                    key={task.id}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    aria-label={label}
                    disabled={maxSelected}
                    onClick={() => toggleTask(task.id)}
                    className={[
                      'flex w-full items-center gap-2 rounded-md p-1 text-left text-xs transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45',
                      selected ? 'bg-muted' : '',
                    ].join(' ')}
                  >
                    <SelectionIndicator selected={selected} type="checkbox" />
                    <OptionPreview
                      color={task.kleur}
                      label={task.afkorting || task.omschrijving || `Taak ${task.id}`}
                      slot="top"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{task.afkorting || task.omschrijving || `Taak ${task.id}`}</span>
                      {task.afkorting && task.omschrijving ? (
                        <span className="block truncate text-muted-foreground">{task.omschrijving}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Geen taken beschikbaar.</p>
          )}
        </BuilderSection>

        {availabilityTypes.length > 0 ? (
          <BuilderSection
            id="availability"
            title="FTE"
            selectedCount={selection.availabilityId == null ? 0 : 1}
            isOpen={openSections.availability}
            onToggle={() => toggleSection('availability')}
            onClear={() => onAvailabilityChange(null)}
          >
            <div className="space-y-1" role="radiogroup" aria-label="FTE">
              {availabilityTypes.map((availability) => {
                const selected = selection.availabilityId === availability.id;
                return (
                  <button
                    key={availability.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={availability.naam}
                    onClick={() => selectAvailability(availability.id)}
                    className={[
                      'flex w-full items-center gap-2 rounded-md p-1 text-left text-xs transition hover:bg-muted',
                      selected ? 'bg-muted' : '',
                    ].join(' ')}
                  >
                    <SelectionIndicator selected={selected} type="radio" />
                    <OptionPreview
                      color={availability.kleur}
                      label={availability.code || availability.naam}
                      icon={activiteitenIconPath(availability.icon)}
                    />
                    <span className="min-w-0 truncate font-semibold">{availability.naam}</span>
                  </button>
                );
              })}
            </div>
          </BuilderSection>
        ) : null}
      </div>
    </aside>
  );
}
