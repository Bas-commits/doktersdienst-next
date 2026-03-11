import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { MonthNavigation } from './MonthNavigation';

const meta = {
  title: 'Components/MonthNavigation',
  component: MonthNavigation,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    month: {
      control: { type: 'number', min: 0, max: 11 },
      description: 'Current month (0-based, e.g. 2 = March)',
    },
    year: {
      control: 'number',
      description: 'Current year',
    },
    onSelectMonth: {
      action: 'onSelectMonth',
      description: 'Called when the user selects a month (month, year)',
    },
  },
  args: {
    month: 2,
    year: 2025,
    onSelectMonth: fn(),
  },
} satisfies Meta<typeof MonthNavigation>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    month: 2,
    year: 2025,
  },
};

function MonthNavigationInteractive() {
  const [month, setMonth] = useState(2);
  const [year, setYear] = useState(2025);
  return (
    <div>
      <p className="text-sm text-gray-500 mb-2">
        Current: {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month]} {year}
      </p>
      <MonthNavigation
        month={month}
        year={year}
        onSelectMonth={(m, y) => {
          setMonth(m);
          setYear(y);
        }}
      />
    </div>
  );
}

export const Interactive: Story = {
  render: () => <MonthNavigationInteractive />,
};
