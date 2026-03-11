import type { Meta, StoryObj } from '@storybook/react';
import { CalendarGrid } from './CalendarGrid';
import { CalendarGridWithNavState } from './CalendarGridWithNavState';
import { waarneemgroepRows } from './CalendarGrid.fixtures';
import type { DienstenResponse } from '@/types/diensten';
import type { ShiftBlockView } from '@/types/diensten';
import { dienstenToShiftBlocks } from '@/hooks/useDienstenSchedule';

const meta = {
  title: 'Components/CalendarGrid',
  component: CalendarGrid,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    viewMonth: {
      control: 'number',
      description: 'Month to display (0-based, e.g. 2 = March)',
    },
    viewYear: {
      control: 'number',
      description: 'Year to display',
    },
  },
  args: {
    viewMonth: 2,
    viewYear: 2025,
  },
  decorators: [
    (Story) => (
      <div className="w-[1000px] h-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CalendarGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

const dummyDienstenResponse: DienstenResponse = {
  data: {
    diensten: [
      // Slot + main doctor on 10 March 2025
      {
        id: 1168499,
        iddeelnemer: 0,
        van: 1741282800, // 2025-03-10 08:00 (example)
        tot: 1741315200, // 2025-03-10 17:00
        type: 1,
        diensten_deelnemers: null,
      },
      {
        id: 1243621,
        iddeelnemer: 1,
        van: 1741282800,
        tot: 1741315200,
        type: 0,
        diensten_deelnemers: {
          id: 1,
          voornaam: 'Jan',
          achternaam: 'de Vries',
          color: '#3b82f6',
        },
      },
      // Achterwacht on same slot
      {
        id: 1243622,
        iddeelnemer: 2,
        van: 1741282800,
        tot: 1741315200,
        type: 5,
        diensten_deelnemers: {
          id: 2,
          voornaam: 'Marie',
          achternaam: 'Smith',
          color: '#10b981',
        },
      },
      // Extra doctor on 12 March 2025
      {
        id: 1243623,
        iddeelnemer: 0,
        van: 1741455600, // 2025-03-12 08:00
        tot: 1741488000, // 2025-03-12 17:00
        type: 1,
        diensten_deelnemers: null,
      },
      {
        id: 1243624,
        iddeelnemer: 3,
        van: 1741455600,
        tot: 1741488000,
        type: 9,
        diensten_deelnemers: {
          id: 3,
          voornaam: 'Pieter',
          achternaam: 'Kramer',
          color: '#f59e0b',
        },
      },
    ],
  },
};

const dummyShiftBlocks: ShiftBlockView[] = dienstenToShiftBlocks(dummyDienstenResponse);

export const WithThreeShiftBlocks: Story = {
  args: {
    shiftBlocks: dummyShiftBlocks,
    viewMonth: 2,
    viewYear: 2025,
  },
};

export const WithMonthNavigation: Story = {
  args: {
    shiftBlocks: dummyShiftBlocks,
    viewMonth: 2,
    viewYear: 2025,
  },
  render: () => (
    <CalendarGridWithNavState
      shiftBlocks={dummyShiftBlocks}
      initialViewMonth={2}
      initialViewYear={2025}
    />
  ),
};

/** Multiple rows per week, one per waarneemgroep. Each row has its own shift blocks. */
export const WithWaarneemgroepRows: Story = {
  args: {
    rows: waarneemgroepRows,
    viewMonth: 2,
    viewYear: 2025,
  },
  render: () => (
    <CalendarGridWithNavState
      rows={waarneemgroepRows}
      initialViewMonth={2}
      initialViewYear={2025}
    />
  ),
};
