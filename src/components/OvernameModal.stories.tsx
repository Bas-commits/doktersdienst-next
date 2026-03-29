import type { Meta, StoryObj } from '@storybook/react';
import { OvernameModal } from './OvernameModal';
import type { ShiftBlockView } from '@/types/diensten';

const meta = {
  title: 'Components/OvernameModal',
  component: OvernameModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OvernameModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseShift: ShiftBlockView = {
  id: 1,
  day: 10,
  month: 2,
  year: 2025,
  van: 1741600800,
  tot: 1741629600,
  startTime: '08:00',
  endTime: '16:00',
  currentDate: '2025-03-10 08:00:00',
  nextDate: '2025-03-10 16:00:00',
  middle: { id: 1, name: 'Jan de Vries', shortName: 'JD', color: '#3b82f6' },
  top: null,
  bottom: null,
  label: 'Ochtend',
};

const doctors = [
  { id: 2, voornaam: 'Marie', achternaam: 'Smith', initialen: 'MS' },
  { id: 3, voornaam: 'Pieter', achternaam: 'Kramer', initialen: 'PK' },
  { id: 4, voornaam: 'Anna', achternaam: 'Bakker', initialen: 'AB' },
];

export const Default: Story = {
  args: {
    shift: baseShift,
    doctors,
    onSubmit: () => {},
    onClose: () => {},
  },
};

export const DeelsOvername: Story = {
  args: {
    shift: baseShift,
    doctors,
    onSubmit: () => {},
    onClose: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: 'Open the modal and check "Deels overname" to reveal time pickers for a partial shift takeover.',
      },
    },
  },
};

export const Submitting: Story = {
  args: {
    shift: baseShift,
    doctors,
    onSubmit: () => {},
    onClose: () => {},
    submitting: true,
  },
};

export const WithError: Story = {
  args: {
    shift: baseShift,
    doctors,
    onSubmit: () => {},
    onClose: () => {},
    error: 'Active proposal already exists for this shift',
  },
};
