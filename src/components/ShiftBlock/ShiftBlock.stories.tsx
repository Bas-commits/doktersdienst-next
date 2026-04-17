import type { Meta, StoryObj } from '@storybook/react';
import { ShiftBlock } from './ShiftBlock';
import type { ShiftBlockView, DoctorInfo } from '@/types/diensten';
import { getChipByCode } from '@/types/voorkeuren';

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
    continuesFromPrev: {
      control: 'boolean',
      description: 'Segment continues from previous day/row; removes left border, gradient on Monday',
    },
    continuesToNext: {
      control: 'boolean',
      description: 'Segment continues to next day/row; removes right border, gradient on Sunday',
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

/** Voorkeuren page: block with a saved preference (Liever wel). Shows preference icon and color instead of user initials. */
export const VoorkeurenPreferenceFilled: Story = {
  args: {
    block: baseBlock,
    ...cellDate,
    preferenceChip: getChipByCode('3'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Middle strip shows the preference icon and background color (Liever wel: green + check). Same look as when a preference is clicked on the voorkeuren page. Other codes (2, 9, 10, 5001) use the same mechanism.',
      },
    },
  },
};

/** /voorkeuren main grid: filled preference with middle populated (e.g. after reload) — icon only, no initials. */
export const VoorkeurenPreferenceFilledIconOnly: Story = {
  args: {
    block: baseBlock,
    ...cellDate,
    preferenceChip: getChipByCode('3'),
    hideInitialsInPreferenceFill: true,
  },
};

/** Voorkeuren: Vakantie preference (yellow + palm icon). */
export const VoorkeurenPreferenceVakantie: Story = {
  args: {
    block: baseBlock,
    ...cellDate,
    preferenceChip: getChipByCode('9'),
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

/** March 9, 2025 is Sunday; March 10, 2025 is Monday (for cross-row shadow). */
const sundayCell = { day: 9, month: 2, year: 2025 };
const mondayCell = { day: 10, month: 2, year: 2025 };

/** Block that continues from the previous day (e.g. overnight into this cell). Left border removed; on Monday, inset shadow creates gradient to the left. */
export const ContinuesFromPrev: Story = {
  args: {
    block: {
      ...baseBlock,
      id: 6,
      startTime: '22:00',
      endTime: '08:00',
      currentDate: '2025-03-09 22:00:00',
      nextDate: '2025-03-10 08:00:00',
      middle: doctor1,
    },
    ...mondayCell,
    containerWidth: 400,
    continuesFromPrev: true,
    segmentStartTime: '00:00',
    segmentEndTime: '08:00',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Segment that continues from the previous row/cell. Left border is removed; on Monday (new row) a white inset shadow gives a gradient to the left.',
      },
    },
  },
};

/** Block that continues to the next day. Right border removed; on Sunday, inset shadow creates gradient to the right. */
export const ContinuesToNext: Story = {
  args: {
    block: {
      ...baseBlock,
      id: 7,
      startTime: '22:00',
      endTime: '08:00',
      currentDate: '2025-03-09 22:00:00',
      nextDate: '2025-03-10 08:00:00',
      middle: doctor2,
    },
    ...sundayCell,
    containerWidth: 400,
    continuesToNext: true,
    segmentStartTime: '22:00',
    segmentEndTime: '24:00',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Segment that continues to the next row/cell. Right border is removed; on Sunday (end of row) a white inset shadow gives a gradient to the right.',
      },
    },
  },
};

/** Middle of a multi-day segment: continues both from previous and to next (no rounded corners on sides). */
export const ContinuesBoth: Story = {
  args: {
    block: {
      ...baseBlock,
      id: 8,
      startTime: '22:00',
      endTime: '08:00',
      currentDate: '2025-03-11 22:00:00',
      nextDate: '2025-03-12 08:00:00',
      middle: doctor3,
    },
    day: 12,
    month: 2,
    year: 2025,
    containerWidth: 400,
    continuesFromPrev: true,
    continuesToNext: true,
    segmentStartTime: '00:00',
    segmentEndTime: '24:00',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Segment in the middle of a multi-day shift. Both left and right borders removed; no rounding on sides.',
      },
    },
  },
};

/** Two blocks simulating end of one row (Sunday) and start of next row (Monday) to show the gradient effect when a shift continues across rows. */
export const CrossRowContinuation: Story = {
  args: {
    block: baseBlock,
    ...cellDate,
    containerWidth: 400,
  },
  render(args) {
    const containerWidth = (args as any).containerWidth ?? 400;
    const overnightBlock: ShiftBlockView = {
      ...baseBlock,
      id: 9,
      startTime: '22:00',
      endTime: '08:00',
      currentDate: '2025-03-09 22:00:00',
      nextDate: '2025-03-10 08:00:00',
      middle: doctor1,
    };
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs text-gray-600 mb-1">Sunday (end of row) — continues to next → gradient to the right</p>
          <div
            className="relative bg-[#a7a2a2]"
            style={{ width: containerWidth, minHeight: 96, overflow: 'visible' }}
          >
            <ShiftBlock
              block={overnightBlock}
              {...sundayCell}
              containerWidth={containerWidth}
              continuesToNext={true}
              segmentStartTime="22:00"
              segmentEndTime="24:00"
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Monday (start of row) — continues from previous → gradient to the left</p>
          <div
            className="relative bg-[#a7a2a2]"
            style={{ width: containerWidth, minHeight: 96, overflow: 'visible' }}
          >
            <ShiftBlock
              block={overnightBlock}
              {...mondayCell}
              containerWidth={containerWidth}
              continuesFromPrev={true}
              segmentStartTime="00:00"
              segmentEndTime="08:00"
            />
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Overnight shift split across two rows: Sunday segment (right gradient) and Monday segment (left gradient). Shows the inset shadow effect when a shift continues on another row.',
      },
    },
  },
};
