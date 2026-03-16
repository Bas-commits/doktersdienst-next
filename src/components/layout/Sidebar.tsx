'use client';

import {
  Calendar,
  CalendarPlus,
  Settings,
  ArrowLeftRight,
  Clock,
  Phone,
} from 'lucide-react';

const SIDEBAR_NAV_ITEMS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'rooster_inzien', label: 'Rooster', icon: <Calendar className="size-4 shrink-0" /> },
  {
    id: 'rooster_maken_secretatis',
    label: 'Rooster Maken Secretatis',
    icon: <CalendarPlus className="size-4 shrink-0" />,
  },
  { id: 'voorkeuren', label: 'Voorkeuren', icon: <Settings className="size-4 shrink-0" /> },
  {
    id: 'rooster_overname',
    label: 'Overnamens',
    icon: <ArrowLeftRight className="size-4 shrink-0" />,
  },
  {
    id: 'urentelling_filter',
    label: 'Urentelling Filter',
    icon: <Clock className="size-4 shrink-0" />,
  },
  { id: 'gesprekken', label: 'Gesprekken', icon: <Phone className="size-4 shrink-0" /> },
  {
    id: 'welcome_jsx',
    label: 'Rooster Inzien JSX 1',
    icon: <Calendar className="size-4 shrink-0" />,
  },
  {
    id: 'rooster_jsx',
    label: 'Rooster Inzien JSX 2',
    icon: <Calendar className="size-4 shrink-0" />,
  },
  {
    id: 'voorkeuren_jsx',
    label: 'Voorkeuren JSX',
    icon: <Settings className="size-4 shrink-0" />,
  },
  {
    id: 'rooster_maken_jsx',
    label: 'Rooster Maken JSX',
    icon: <CalendarPlus className="size-4 shrink-0" />,
  },
  {
    id: 'gesprekken_jsx',
    label: 'Gesprekken JSX',
    icon: <Phone className="size-4 shrink-0" />,
  },
  {
    id: 'overname_jsx',
    label: 'Overnames JSX',
    icon: <ArrowLeftRight className="size-4 shrink-0" />,
  },
];

export function Sidebar() {
  return (
    <aside className="sidebar w-56 shrink-0 border-r border-border bg-muted/30">
      <nav className="p-4" aria-label="Hoofdnavigatie">
        <ul className="sidebar-nav flex flex-col gap-1">
          {SIDEBAR_NAV_ITEMS.map((item) => (
            <li key={item.id} id={item.id} className="nav-item">
              <a
                href="#"
                className="nav-link flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => e.preventDefault()}
              >
                {item.icon}
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
