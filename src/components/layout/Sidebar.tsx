'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Calendar,
  Settings,
  ArrowLeftRight,
} from 'lucide-react';

const SIDEBAR_NAV_ITEMS: {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}[] = [
  { id: 'rooster_inzien', label: 'Rooster', href: '/rooster-inzien', icon: <Calendar className="size-4 shrink-0" /> },
  { id: 'overnames', label: 'Overnames', href: '/overnames', icon: <ArrowLeftRight className="size-4 shrink-0" /> },
  { id: 'voorkeuren', label: 'Voorkeuren', href: '/voorkeuren', icon: <Settings className="size-4 shrink-0" /> },
];

const ACTIVE_BG = '#c91b23';

export function Sidebar() {
  const router = useRouter();
  const pathname = router.pathname;

  return (
    <aside className="sidebar w-56 shrink-0 border-r border-border bg-muted/30">
      <nav className="p-4" aria-label="Hoofdnavigatie">
        <ul className="sidebar-nav flex flex-col gap-1">
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.id} id={item.id} className="nav-item">
                <Link
                  href={item.href}
                  className={[
                    'nav-link flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    'focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted/30',
                    isActive
                      ? 'border-[#c91b23] text-white'
                      : 'border-transparent text-muted-foreground hover:border-[#c91b23]/40 hover:bg-muted/90 hover:text-foreground hover:shadow-sm',
                  ].join(' ')}
                  style={{
                    backgroundColor: isActive ? ACTIVE_BG : undefined,
                  }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
