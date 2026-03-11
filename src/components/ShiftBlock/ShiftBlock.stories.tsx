import type { Meta, StoryObj } from '@storybook/react';
import { ShiftBlock } from './ShiftBlock';
import type { ShiftBlockView, DoctorInfo } from '@/types/diensten';

const meta = {
  title: 'Components/ShiftBlock',
  component: ShiftBlock,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    containerWidth: {
      control: 'number',
      description: 'Width in pixels representing the 00:00–24:00 time axis',
    },
    onClick: {
      action: 'clicked',
      description: 'Fired when the active section is clicked',
    },
    onSectionClick: {
      action: 'sectionClicked',
      description: 'Fired when a section (top/middle/bottom) is clicked',
    },
    onDelete: {
      action: 'delete',
      description: 'Fired when the delete button is clicked',
    },
    activeSection: {
      control: 'select',
      options: ['top', 'middle', 'bottom'],
      description: 'Which strip receives click (when not using onSectionClick)',
    },
    showEmptyTopStripBorder: {
      control: 'boolean',
      description: 'Show gray border on empty top (Achterwacht) strip',
    },
    showEmptyBottomStripBorder: {
      control: 'boolean',
      description: 'Show gray border on empty bottom (Extra Dokter) strip',
    },
    hideTopStrip: {
      control: 'boolean',
      description: 'Hide the top strip',
    },
    hideBottomStrip: {
      control: 'boolean',
      description: 'Hide the bottom strip',
    },
  },
  args: {
    onDelete: undefined,
    containerWidth: 400,
  },
  decorators: [
    (Story, context) => {
      const containerWidth = (context.args as any).containerWidth ?? 400;
      const minWidth = containerWidth;
      const minHeight = 96; // enough for top strip + middle (42px) + bottom strip + margins
      return (
        <div
          className="width-full bg-[#a7a2a2]"
          style={{ minWidth, minHeight, width: containerWidth, overflow: 'visible' }}
        >
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof ShiftBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

const doctor1: DoctorInfo = {
  id: 1,
  name: 'Jan de Vries',
  shortName: 'JD',
  color: '#3b82f6',
};

const doctor2: DoctorInfo = {
  id: 2,
  name: 'Marie Smith',
  shortName: 'MS',
  color: '#10b981',
};

const doctor3: DoctorInfo = {
  id: 3,
  name: 'Pieter Kramer',
  shortName: 'PK',
  color: '#f59e0b',
};

const baseBlock: ShiftBlockView = {
  id: 1,
  day: 10,
  month: 2,
  year: 2025,
  van: 1741282800,
  tot: 1741315200,
  startTime: '08:00',
  endTime: '16:00',
  currentDate: '2025-03-10 08:00:00',
  nextDate: '2025-03-10 16:00:00',
  middle: doctor1,
  top: null,
  bottom: null,
  label: 'Ochtend',
};

const unassignedBlock: ShiftBlockView = {
  ...baseBlock,
  id: 2,
  middle: null,
};

const blockWithAchterwachtAndExtra: ShiftBlockView = {
  ...baseBlock,
  id: 3,
  top: doctor2,
  bottom: doctor3,
};

const cellDate = { day: 10, month: 2, year: 2025 };

export const Default: Story = {
  args: {
    block: baseBlock,
    ...cellDate,
  },
};

export const roosterInzienShiftBlock: Story = {
  args: {
    block: baseBlock,
    ...cellDate,
  },
};

export const UnassignedSlot: Story = {
  args: {
    block: unassignedBlock,
    ...cellDate,
  },
};

export const WithAchterwachtAndExtra: Story = {
  args: {
    block: blockWithAchterwachtAndExtra,
    ...cellDate,
  },
};

export const PendingDoctor: Story = {
  args: {
    block: unassignedBlock,
    ...cellDate,
    pendingDoctor: { color: '#8b5cf6', shortName: 'AB' },
  },
};

export const PendingDoctorsTopBottom: Story = {
  args: {
    block: {
      ...baseBlock,
      top: null,
      bottom: null,
    },
    ...cellDate,
    showEmptyTopStripBorder: true,
    showEmptyBottomStripBorder: true,
    pendingDoctorTop: { color: '#06b6d4', shortName: 'XY' },
    pendingDoctorBottom: { color: '#ec4899', shortName: 'Z' },
  },
};

export const WithDeleteButton: Story = {
  args: {
    block: baseBlock,
    ...cellDate,
    onDelete: () => {},
  },
};

export const SectionClicks: Story = {
  args: {
    block: blockWithAchterwachtAndExtra,
    ...cellDate,
    showEmptyTopStripBorder: true,
    showEmptyBottomStripBorder: true,
    onSectionClick: (_section, _e) => {},
  },
};

export const PendingRemoveSections: Story = {
  args: {
    block: blockWithAchterwachtAndExtra,
    ...cellDate,
    pendingRemoveSections: new Set(['top', 'bottom']),
  },
};

export const MiddleOnly: Story = {
  args: {
    block: baseBlock,
    ...cellDate,
    hideTopStrip: true,
    hideBottomStrip: true,
  },
};

export const Clickable: Story = {
  args: {
    block: baseBlock,
    ...cellDate,
    onClick: () => {},
  },
};

export const TimeScaleTwoBlocks: Story = {
  args: {
    block: baseBlock,
    ...cellDate,
    containerWidth: 400,
  },
  render(args) {
    const containerWidth = (args as any).containerWidth ?? 400;
    const dayBlock: ShiftBlockView = {
      ...baseBlock,
      id: 4,
      startTime: '08:00',
      endTime: '16:00',
      currentDate: '2025-03-10 08:00:00',
      nextDate: '2025-03-10 16:00:00',
      middle: doctor1,
    };
    const nightBlock: ShiftBlockView = {
      ...baseBlock,
      id: 5,
      startTime: '16:00',
      endTime: '04:00',
      currentDate: '2025-03-10 16:00:00',
      nextDate: '2025-03-11 04:00:00',
      middle: doctor2,
    };

    return (
      <div
        className="relative bg-[#a7a2a2]"
        style={{ width: containerWidth, minHeight: 120, overflow: 'visible' }}
      >
        <ShiftBlock
          {...args}
          block={dayBlock}
          containerWidth={containerWidth}
        />
        <ShiftBlock
          {...args}
          block={nightBlock}
          containerWidth={containerWidth}
        />
      </div>
    );
  },
};
