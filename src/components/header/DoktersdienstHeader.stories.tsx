import type { Meta, StoryObj } from '@storybook/nextjs';
import { DoktersdienstHeader } from './DoktersdienstHeader';
import {
  DEFAULT_ASSET_URLS,
  DEFAULT_ROUTES,
  EMPTY_WAARNEMGROEPEN,
} from '@/lib/header-defaults';

const defaultWaarneemgroepen = [
  { ID: 1, naam: 'Waarneemgroep Noord' },
  { ID: 2, naam: 'Waarneemgroep Zuid' },
  { ID: 3, naam: 'Waarneemgroep Oost' },
];

const meta = {
  component: DoktersdienstHeader,
  title: 'Components/Header/DoktersdienstHeader',
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    waarneemgroepen: defaultWaarneemgroepen,
    headerUser: {
      UserName: 'Jan de Vries',
      ShortName: 'JV',
      TypeOfUser: 'Doctor',
    },
    routes: DEFAULT_ROUTES,
    routeName: null,
    assetUrls: DEFAULT_ASSET_URLS,
  },
} satisfies Meta<typeof DoktersdienstHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Default header for a doctor: group selector, switch requests, user menu. No admin tools. */
export const Default: Story = {};

/** Admin user: zelfde header als andere rollen; beheer staat in de sidebar. */
export const AdminUser: Story = {
  args: {
    headerUser: {
      UserName: 'Marie Admin',
      ShortName: 'MA',
      TypeOfUser: 'Admin',
    },
  },
};

/** Single waarneemgroep in the selector. */
export const SingleWaarneemgroep: Story = {
  args: {
    waarneemgroepen: [{ ID: 1, naam: 'Enige groep' }],
  },
};

/** No waarneemgroepen: empty dropdown. */
export const NoWaarneemgroepen: Story = {
  args: {
    waarneemgroepen: EMPTY_WAARNEMGROEPEN,
  },
};

/** Current route highlighted in admin menu (e.g. Gebruikers beheren). */
export const ActiveRouteGebruikers: Story = {
  args: {
    headerUser: {
      UserName: 'Marie Admin',
      ShortName: 'MA',
      TypeOfUser: 'Admin',
    },
    routeName: 'gebruikers_jsx',
  },
};
