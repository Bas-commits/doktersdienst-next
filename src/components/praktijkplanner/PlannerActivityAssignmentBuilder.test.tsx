/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlannerActivityAssignmentBuilder } from './PlannerActivityAssignmentBuilder';

type Selection = {
  activityId: number | null;
  specificationId: number | null;
  taskIds: number[];
  locationId: number | null;
  availabilityId: number | null;
};

const activities = [
  {
    id: 1,
    naam: 'Algemeen',
    afkorting: 'ALG',
    kleur: '#008000',
    icon: null,
    idexpertise: null,
    actief: true,
  },
];

const specifications = [
  {
    id: 2,
    idactiviteit: 1,
    naam: 'Spreekuur',
    afkorting: 'SP',
    kleur: '#008000',
    actief: true,
  },
];

const tasks = [
  { id: 11, afkorting: 'SV', omschrijving: 'Supervisie', kleur: '#800080', idexpertise: null, actief: true, nietLocatieGebonden: false },
  { id: 12, afkorting: 'TR', omschrijving: 'Translatie', kleur: '#f59e0b', idexpertise: null, actief: true, nietLocatieGebonden: false },
  { id: 13, afkorting: 'OP', omschrijving: 'Overleg', kleur: '#0ea5e9', idexpertise: null, actief: true, nietLocatieGebonden: false },
  { id: 14, afkorting: 'AD', omschrijving: 'Administratie', kleur: '#64748b', idexpertise: null, actief: true, nietLocatieGebonden: false },
];

const locations = [
  {
    id: 21,
    naam: 'Utrecht',
    afkorting: 'UT',
    kleur: '#fb7185',
    actief: true,
    idlocatie: null,
  },
];

afterEach(cleanup);

function BuilderHarness() {
  const [selection, setSelection] = useState<Selection>({
    activityId: null,
    specificationId: null,
    taskIds: [],
    locationId: null,
    availabilityId: null,
  });
  const [clearMode, setClearMode] = useState(false);

  return (
    <PlannerActivityAssignmentBuilder
      activities={activities}
      specifications={specifications}
      tasks={tasks}
      locations={locations}
      availabilityTypes={[]}
      selection={selection}
      clearMode={clearMode}
      onActivityChange={(activityId) =>
        setSelection((current) => ({
          ...current,
          activityId,
          specificationId: activityId == null ? null : current.specificationId,
        }))
      }
      onSpecificationChange={(specificationId) =>
        setSelection((current) => ({ ...current, specificationId }))
      }
      onTaskChange={(taskIds) => setSelection((current) => ({ ...current, taskIds }))}
      onLocationChange={(locationId) => setSelection((current) => ({ ...current, locationId }))}
      onAvailabilityChange={(availabilityId) =>
        setSelection((current) => ({ ...current, availabilityId }))
      }
      onClearSelection={() =>
        setSelection({
          activityId: null,
          specificationId: null,
          taskIds: [],
          locationId: null,
          availabilityId: null,
        })
      }
      onClearModeChange={setClearMode}
    />
  );
}

describe('PlannerActivityAssignmentBuilder', () => {
  it('composes a chip from optional activity, task and location selections', () => {
    render(<BuilderHarness />);

    fireEvent.click(screen.getByRole('radio', { name: 'ALG Algemeen' }));
    fireEvent.click(screen.getByRole('radio', { name: 'SP Spreekuur' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'SV Supervisie' }));
    fireEvent.click(screen.getByRole('radio', { name: 'UT Utrecht' }));

    const builder = screen.getByLabelText('Dagdeel samenstellen');
    expect(within(builder).getByText('ALG · SP')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'SV Supervisie' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'UT Utrecht' })).toHaveAttribute('aria-checked', 'true');

    const taskRows = Array.from(
      screen.getByRole('checkbox', { name: 'SV Supervisie' }).querySelectorAll('[data-planner-daypart-chip-row]')
    );
    const activityRows = Array.from(
      screen.getByRole('radio', { name: 'ALG Algemeen' }).querySelectorAll('[data-planner-daypart-chip-row]')
    );
    const locationRows = Array.from(
      screen.getByRole('radio', { name: 'UT Utrecht' }).querySelectorAll('[data-planner-daypart-chip-row]')
    );
    expect(taskRows.map((row) => row.textContent)).toEqual(['SV', '', '']);
    expect(activityRows.map((row) => row.textContent)).toEqual(['', 'ALG', '']);
    expect(locationRows.map((row) => row.textContent)).toEqual(['', '', 'UT']);

    fireEvent.click(screen.getByRole('button', { name: 'Wis selectie' }));
    expect(
      within(builder).getByText('Kies een activiteit, taak of locatie en klik daarna op een dagdeel.')
    ).toBeInTheDocument();
  });

  it('limits task selection to three and lets sections collapse', () => {
    render(<BuilderHarness />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'SV Supervisie' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'TR Translatie' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'OP Overleg' }));

    expect(screen.getByRole('checkbox', { name: 'AD Administratie' })).toBeDisabled();

    const activitiesToggle = screen.getByRole('button', { name: /Activiteiten/ });
    expect(activitiesToggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(activitiesToggle);
    expect(activitiesToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('radio', { name: 'ALG Algemeen' })).not.toBeInTheDocument();
  });
});
