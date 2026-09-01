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
  useRouter: () => ({ pathname: '/praktijkplanner/afwezigheidsplanner-dokter' }),
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

    expect(screen.getByText('Rooster inzien')).toBeInTheDocument();
    expect(screen.getByText('Afwezigheidsplanner dokter')).toBeInTheDocument();
    expect(screen.getByText('Absentie telling')).toBeInTheDocument();
    expect(screen.getByText('Capaciteits rapportage')).toBeInTheDocument();
    expect(screen.queryByText('Activiteiten planner')).not.toBeInTheDocument();
    expect(screen.queryByText('Deze waarneemgroep')).not.toBeInTheDocument();
    expect(screen.queryByText('Capaciteitsplanner')).not.toBeInTheDocument();
    expect(screen.queryByText('Plannerbeheer')).not.toBeInTheDocument();
  });

  it('noemt het afwezigheidsscherm zoals het scherm zichzelf noemt', () => {
    // De menuoptie heette altijd "Afwezigheidsplanner dokter", ook bij een groep waar de kop van
    // dat scherm "Afwezigheids- en dienstvoorkeur" is. Twee namen voor hetzelfde scherm.
    cleanup();
    render(<Sidebar section="praktijkplanner" roleTier={GROEP_DEELNEMER} plantDiensten />);

    expect(screen.getByText('Afwezigheids- en dienstvoorkeur')).toBeInTheDocument();
    expect(screen.queryByText('Afwezigheidsplanner dokter')).not.toBeInTheDocument();
  });

  it('shows secretaris pages including Plannerbeheer and doktersdienst embeds', () => {
    cleanup();
    render(<Sidebar section="praktijkplanner" roleTier={GROEP_SECRETARIS} />);

    expect(screen.getByText('Deze waarneemgroep')).toBeInTheDocument();
    expect(screen.getByText('Lijst deelnemers')).toBeInTheDocument();
    expect(screen.getByText('Activiteiten planner')).toBeInTheDocument();
    expect(screen.getByText('Afwezigheidsplanner')).toBeInTheDocument();
    expect(screen.getByText('Capaciteitsplanner')).toBeInTheDocument();
    expect(screen.getByText('Capaciteitsoverzicht')).toBeInTheDocument();
    expect(screen.getByText('Plannerbeheer')).toBeInTheDocument();

    expect(screen.getByText('Deze waarneemgroep').closest('a')).toHaveAttribute(
      'href',
      '/praktijkplanner/waarneemgroep-wijzigen'
    );
    expect(screen.getByText('Lijst deelnemers').closest('a')).toHaveAttribute(
      'href',
      '/praktijkplanner/lijst-deelnemers'
    );
  });

  it('shows deelnemer and secretaris pages for an administrator', () => {
    cleanup();
    render(<Sidebar section="praktijkplanner" roleTier={GROEP_ADMINISTRATOR} />);

    expect(screen.getByText('Afwezigheidsplanner dokter')).toBeInTheDocument();
    expect(screen.getByText('Activiteiten planner')).toBeInTheDocument();
    expect(screen.getByText('Plannerbeheer')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
});
