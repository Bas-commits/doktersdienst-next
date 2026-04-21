'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Calendar,
  ArrowLeftRight,
  PlusSquare,
  Check,
  PencilLine,
  MapPinPlus,
  Building2,
  UserPlus,
  UserPlus2,
  List,
  FolderPlus,
  Palmtree,
  Shield,
} from 'lucide-react';
import { FaCalendarPlus } from 'react-icons/fa';
import { DEFAULT_ROUTES } from '@/lib/header-defaults';

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const MAIN_NAV_ITEMS: NavItem[] = [
  { id: 'rooster_inzien', label: 'Rooster', href: '/rooster-inzien', icon: <Calendar className="size-4 shrink-0" /> },
  { id: 'voorkeuren', label: 'Voorkeuren', href: '/voorkeuren', icon: <Check className="size-4 shrink-0" /> },
  { id: 'rooster-maken-secretaris', label: 'Rooster maken secretaris', href: '/rooster-maken-secretaris', icon: <FaCalendarPlus className="size-4 shrink-0" /> },
  { id: 'overnames', label: 'Overnames', href: '/overnames', icon: <ArrowLeftRight className="size-4 shrink-0" /> },
];

const SECRETARIS_NAV_ITEMS: NavItem[] = [
  {
    id: 'waarneemgroep-wijzigen',
    label: 'Waarneemgroep wijzigen',
    href: DEFAULT_ROUTES.waarneemgroep_wijzigen,
    icon: <PencilLine className="size-4 shrink-0" />,
  },
  {
    id: 'waarneemgroep-gegevens',
    label: 'Deze waarneemgroep',
    href: DEFAULT_ROUTES.waarneemgroep_gegevens,
    icon: <Building2 className="size-4 shrink-0" />,
  },
  {
    id: 'deelnemer-toevoegen',
    label: 'Deelnemer toevoegen',
    href: DEFAULT_ROUTES.deelnemer_toevoegen,
    icon: <UserPlus className="size-4 shrink-0" />,
  },
  {
    id: 'bestaande-deelnemer-toevoegen',
    label: 'Bestaande deelnemer toevoegen',
    href: DEFAULT_ROUTES.bestaande_toevoegen,
    icon: <UserPlus2 className="size-4 shrink-0" />,
  },
  {
    id: 'lijst-deelnemers',
    label: 'Lijst deelnemers',
    href: DEFAULT_ROUTES.lijst_deelnemers,
    icon: <List className="size-4 shrink-0" />,
  },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    id: 'diensten-toevoegen',
    label: 'Shifts toevoegen',
    href: '/diensten-toevoegen',
    icon: <PlusSquare className="size-4 shrink-0" />,
  },
  {
    id: 'regio-toevoegen',
    label: 'Regio toevoegen',
    href: DEFAULT_ROUTES.regio_toevoegen,
    icon: <MapPinPlus className="size-4 shrink-0" />,
  },
  {
    id: 'waarneemgroep-toevoegen',
    label: 'Waarneemgroep toevoegen',
    href: DEFAULT_ROUTES.waarneemgroep_toevoegen,
    icon: <FolderPlus className="size-4 shrink-0" />,
  },
  {
    id: 'vakanties',
    label: 'Vakanties',
    href: '/vakanties',
    icon: <Palmtree className="size-4 shrink-0" />,
  },
  {
    id: 'rollen-afmelden',
    label: 'Rollen & afmelden',
    href: DEFAULT_ROUTES.rollen_afmelden,
    icon: <Shield className="size-4 shrink-0" />,
  },
];

const ACTIVE_BG = '#c91b23';

function NavLinkList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <>
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <li key={item.id} id={item.id} className="nav-item">
            <Link
              href={item.href}
              className={[
                'nav-link flex items-center justify-center gap-0 rounded-lg border-l-2 px-2 py-2.5 text-sm font-medium transition-all duration-200 group-hover/sb:justify-start group-hover/sb:gap-3 group-hover/sb:px-3',
                'focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted/30',
                isActive
                  ? 'border-[#c91b23] text-white'
                  : 'border-transparent text-muted-foreground hover:border-[#c91b23]/40 hover:bg-muted/90 hover:text-foreground hover:shadow-sm',
              ].join(' ')}
              style={{
                backgroundColor: isActive ? ACTIVE_BG : undefined,
              }}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
            >
              {item.icon}
              <span className="w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[width,opacity] duration-200 group-hover/sb:w-auto group-hover/sb:opacity-100">
                {item.label}
              </span>
            </Link>
          </li>
        );
      })}
    </>
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <li className="pointer-events-none pt-3 pb-1" aria-hidden>
      <span className="flex h-6 items-center justify-center overflow-hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground group-hover/sb:justify-start group-hover/sb:px-3">
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 group-hover/sb:max-w-[14rem] group-hover/sb:opacity-100">
          {label}
        </span>
      </span>
    </li>
  );
}

export interface SidebarProps {
  /** Secretaris- en admin-secties in de sidebar (niet voor Doctor). */
  showSecretarisAndAdmin?: boolean;
}

export function Sidebar({ showSecretarisAndAdmin = true }: SidebarProps) {
  const router = useRouter();
  const pathname = router.pathname;

  return (
    <aside
      className="sidebar group/sb sticky top-0 h-screen w-14 shrink-0 self-start overflow-hidden border-r border-border bg-muted/30 transition-[width] duration-200 ease-out hover:w-75"
      aria-label="Hoofdnavigatie"
    >
      <nav className="h-full overflow-y-auto px-2 py-4 transition-[padding] duration-200 group-hover/sb:px-4">
        <ul className="sidebar-nav flex flex-col gap-1" role="navigation" aria-label="Hoofdnavigatie">
          <NavLinkList items={MAIN_NAV_ITEMS} pathname={pathname} />
          {showSecretarisAndAdmin && (
            <>
              <SectionHeading label="Secretaris" />
              <NavLinkList items={SECRETARIS_NAV_ITEMS} pathname={pathname} />
              <SectionHeading label="Admin" />
              <NavLinkList items={ADMIN_NAV_ITEMS} pathname={pathname} />
            </>
          )}
        </ul>
      </nav>
    </aside>
  );
}
