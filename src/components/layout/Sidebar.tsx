'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Calendar,
  ArrowLeftRight,
  PlusSquare,
  Check,
  PencilLine,
  MapPin,
  MapPinPlus,
  UserPlus,
  List,
  FolderPlus,
  Palmtree,
  Shield,
  Trash2,
  PhoneCall,
  Clock,
} from 'lucide-react';
import { FaCalendarPlus } from 'react-icons/fa';
import { DEFAULT_ROUTES } from '@/lib/header-defaults';
import {
  GROEP_DEELNEMER,
  hasAdminAccess,
  hasSecretarisAccess,
  type RoleTier,
} from '@/lib/roles';
import type { AppSection } from '@/lib/route-access';
import { dokterAfwezigheidsschermTitel } from '@/lib/praktijkplanner/diensten-in-groep';

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const MAIN_NAV_ITEMS: NavItem[] = [
  { id: 'rooster_inzien', label: 'Rooster', href: '/rooster-inzien', icon: <Calendar className="size-4 shrink-0" /> },
  { id: 'voorkeuren', label: 'Voorkeuren', href: '/voorkeuren', icon: <Check className="size-4 shrink-0" /> },
  { id: 'overnames', label: 'Overnames', href: '/overnames', icon: <ArrowLeftRight className="size-4 shrink-0" /> },
  {
    id: 'urentelling',
    label: 'Urentelling',
    href: '/urentelling',
    icon: <Clock className="size-4 shrink-0" />,
  },
  {
    id: 'locaties',
    label: 'Locaties',
    href: '/locaties',
    icon: <MapPin className="size-4 shrink-0" />,
  },
];

const SECRETARIS_NAV_ITEMS: NavItem[] = [
  {
    id: 'waarneemgroep-wijzigen',
    label: 'Deze waarneemgroep',
    href: DEFAULT_ROUTES.waarneemgroep_wijzigen,
    icon: <PencilLine className="size-4 shrink-0" />,
  },
  {
    id: 'rooster-maken-secretaris',
    label: 'Rooster maken secretaris',
    href: '/rooster-maken-secretaris',
    icon: <FaCalendarPlus className="size-4 shrink-0" />,
  },
  // {
  //   id: 'waarneemgroep-gegevens',
  //   label: 'Deze waarneemgroep',
  //   href: DEFAULT_ROUTES.waarneemgroep_gegevens,
  //   icon: <Building2 className="size-4 shrink-0" />,
  // },
  {
    id: 'deelnemer-toevoegen',
    label: 'Deelnemers beheren',
    href: DEFAULT_ROUTES.deelnemer_toevoegen,
    icon: <UserPlus className="size-4 shrink-0" />,
  },

  {
    id: 'lijst-deelnemers',
    label: 'Lijst deelnemers',
    href: DEFAULT_ROUTES.lijst_deelnemers,
    icon: <List className="size-4 shrink-0" />,
  },
  {
    id: 'gesprekken',
    label: 'Gesprekken',
    href: '/gesprekken',
    icon: <PhoneCall className="size-4 shrink-0" />,
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
  {
    id: 'deelnemers-verwijderen',
    label: 'Deelnemers verwijderen',
    href: DEFAULT_ROUTES.deelnemers_verwijderen,
    icon: <Trash2 className="size-4 shrink-0" />,
  },
];

const PRAKTIJKPLANNER_DEELNEMER_NAV_ITEMS: NavItem[] = [
  {
    id: 'praktijkplanner-rooster-inzien',
    label: 'Rooster inzien',
    href: '/praktijkplanner/rooster-inzien',
    icon: <Calendar className="size-4 shrink-0" />,
  },
  {
    id: 'praktijkplanner-afwezigheidsplanner-dokter',
    // De naam wordt hieronder vervangen door die van het scherm zelf. Zie dokterMenuItems.
    label: 'Afwezigheidsplanner dokter',
    href: '/praktijkplanner/afwezigheidsplanner-dokter',
    icon: <Palmtree className="size-4 shrink-0" />,
  },
  {
    id: 'praktijkplanner-dokter-afwezigheid',
    label: 'Absentie telling',
    href: '/praktijkplanner/dokter-afwezigheid',
    icon: <Clock className="size-4 shrink-0" />,
  },
  {
    id: 'praktijkplanner-dokter-activiteiten',
    label: 'Capaciteits rapportage',
    href: '/praktijkplanner/dokter-activiteiten',
    icon: <List className="size-4 shrink-0" />,
  },
];

const PRAKTIJKPLANNER_SECRETARIS_NAV_ITEMS: NavItem[] = [
  {
    id: 'praktijkplanner-waarneemgroep-wijzigen',
    label: 'Deze waarneemgroep',
    href: '/praktijkplanner/waarneemgroep-wijzigen',
    icon: <PencilLine className="size-4 shrink-0" />,
  },
  {
    id: 'praktijkplanner-lijst-deelnemers',
    label: 'Lijst deelnemers',
    href: '/praktijkplanner/lijst-deelnemers',
    icon: <List className="size-4 shrink-0" />,
  },
  {
    id: 'praktijkplanner-activiteiten',
    label: 'Activiteiten planner',
    href: '/praktijkplanner/activiteiten',
    icon: <Calendar className="size-4 shrink-0" />,
  },
  {
    id: 'praktijkplanner-afwezigheidsplanner',
    label: 'Afwezigheidsplanner',
    href: '/praktijkplanner/afwezigheidsplanner',
    icon: <Palmtree className="size-4 shrink-0" />,
  },
  {
    id: 'praktijkplanner-capaciteitsplanner',
    label: 'Capaciteitsplanner',
    href: '/praktijkplanner/capaciteitsplanner',
    icon: <MapPin className="size-4 shrink-0" />,
  },
  {
    id: 'praktijkplanner-capaciteitsoverzicht',
    label: 'Capaciteitsoverzicht',
    href: '/praktijkplanner/capaciteitsoverzicht',
    icon: <Check className="size-4 shrink-0" />,
  },
  {
    id: 'praktijkplanner-beheer',
    label: 'Plannerbeheer',
    href: '/praktijkplanner/beheer',
    icon: <Shield className="size-4 shrink-0" />,
  },
];

const ACTIVE_BG = '#c91b23';

/**
 * De deelnemersmenu-items, met het afwezigheidsscherm onder de naam die het scherm zelf voert.
 *
 * De menuoptie heette altijd "Afwezigheidsplanner dokter" terwijl de kop van dat scherm
 * "Afwezigheids- en dienstvoorkeur" werd zodra de groep taaktypen als dienst aanmerkt. Twee
 * namen voor hetzelfde scherm, en de menuoptie was de verkeerde van de twee.
 *
 * Het signaal komt van buiten, uit de lijst met waarneemgroepen die de layout al heeft. Niet
 * uit de plannercontext: de zijbalk staat op elke pagina en die context wordt alleen door de
 * plannerschermen zelf opgehaald, dus dat zou een verzoek per pagina extra kosten.
 */
function dokterMenuItems(plantDiensten: boolean): NavItem[] {
  return PRAKTIJKPLANNER_DEELNEMER_NAV_ITEMS.map((item) =>
    item.id === 'praktijkplanner-afwezigheidsplanner-dokter'
      ? { ...item, label: dokterAfwezigheidsschermTitel(plantDiensten) }
      : item
  );
}

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
  roleTier?: RoleTier;
  section?: AppSection;
  /** Merkt de gekozen waarneemgroep taaktypen aan als dienst? Zie dokterMenuItems. */
  plantDiensten?: boolean;
}

export function Sidebar({
  roleTier = GROEP_DEELNEMER,
  section = 'doktersdienst',
  plantDiensten = false,
}: SidebarProps) {
  const router = useRouter();
  const pathname = router.pathname;
  const showSecretaris = hasSecretarisAccess(roleTier);
  const showAdmin = hasAdminAccess(roleTier);
  const isPraktijkplanner = section === 'praktijkplanner';

  return (
    <aside
      className="sidebar group/sb h-full w-14 shrink-0 overflow-hidden border-r border-border bg-muted/30 transition-[width] duration-200 ease-out hover:w-75"
      aria-label={isPraktijkplanner ? 'Praktijkplanner navigatie' : 'Hoofdnavigatie'}
    >
      <nav className="h-full overflow-y-auto px-2 py-4 transition-[padding] duration-200 group-hover/sb:px-4">
        <ul
          className="sidebar-nav flex flex-col gap-1"
          role="navigation"
          aria-label={isPraktijkplanner ? 'Praktijkplanner navigatie' : 'Hoofdnavigatie'}
        >
          {isPraktijkplanner ? (
            <>
              <SectionHeading label="Deelnemer" />
              <NavLinkList
                items={dokterMenuItems(plantDiensten)}
                pathname={pathname}
              />
              {showSecretaris && (
                <>
                  <SectionHeading label="Secretaris" />
                  <NavLinkList items={PRAKTIJKPLANNER_SECRETARIS_NAV_ITEMS} pathname={pathname} />
                </>
              )}
            </>
          ) : (
            <>
              <NavLinkList items={MAIN_NAV_ITEMS} pathname={pathname} />
              {showSecretaris && (
                <>
                  <SectionHeading label="Secretaris" />
                  <NavLinkList items={SECRETARIS_NAV_ITEMS} pathname={pathname} />
                </>
              )}
              {showAdmin && (
                <>
                  <SectionHeading label="Admin" />
                  <NavLinkList items={ADMIN_NAV_ITEMS} pathname={pathname} />
                </>
              )}
            </>
          )}
        </ul>
      </nav>
    </aside>
  );
}
