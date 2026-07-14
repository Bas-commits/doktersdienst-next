/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { Sidebar } from './Sidebar';
import {
  GROEP_ADMINISTRATOR,
  GROEP_DEELNEMER,
  GROEP_SECRETARIS,
} from '@/lib/roles';

vi.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/praktijkplanner/activiteiten' }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('Praktijkplanner Sidebar', () => {
  it('shows only personal planner pages for a deelnemer', () => {
    cleanup();
    render(<Sidebar section="praktijkplanner" roleTier={GROEP_DEELNEMER} />);

    expect(screen.getByText('Activiteiten planner')).toBeInTheDocument();
    expect(screen.getByText('Afwezigheidsplanner dokter')).toBeInTheDocument();
    expect(screen.queryByText('Capaciteit planner')).not.toBeInTheDocument();
    expect(screen.queryByText('Plannerbeheer')).not.toBeInTheDocument();
  });

  it('shows capacity pages for a secretaris but not admin-only planner management', () => {
    cleanup();
    render(<Sidebar section="praktijkplanner" roleTier={GROEP_SECRETARIS} />);

    expect(screen.getByText('Afwezigheidsplanner')).toBeInTheDocument();
    expect(screen.getAllByText('Capaciteit planner').length).toBeGreaterThan(0);
    expect(screen.getByText('Capaciteit overzicht')).toBeInTheDocument();
    expect(screen.queryByText('Plannerbeheer')).not.toBeInTheDocument();
  });

  it('shows Plannerbeheer for an administrator', () => {
    cleanup();
    render(<Sidebar section="praktijkplanner" roleTier={GROEP_ADMINISTRATOR} />);

    expect(screen.getByText('Plannerbeheer')).toBeInTheDocument();
  });
});
