'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Calendar,
  Settings,
  ArrowLeftRight,
  PlusSquare,
  Check 
} from 'lucide-react';
import { FaCalendarPlus } from "react-icons/fa";

const SIDEBAR_NAV_ITEMS: {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}[] = [
  { id: 'rooster_inzien', label: 'Rooster', href: '/rooster-inzien', icon: <Calendar className="size-4 shrink-0" /> },
  { id: 'voorkeuren', label: 'Voorkeuren', href: '/voorkeuren', icon: <Check className="size-4 shrink-0" /> },
  { id: 'rooster-maken-secretaris', label: 'Rooster maken secretaris', href: '/rooster-maken-secretaris', icon: <FaCalendarPlus className="size-4 shrink-0" /> },
  { id: 'overnames', label: 'Overnames', href: '/overnames', icon: <ArrowLeftRight className="size-4 shrink-0" /> },
  { id: 'diensten-toevoegen', label: 'Diensten toevoegen', href: '/diensten-toevoegen', icon: <PlusSquare className="size-4 shrink-0" /> },
];

const ACTIVE_BG = '#c91b23';

export function Sidebar() {
  const router = useRouter();
  const pathname = router.pathname;

  return (
    <aside
      className="sidebar group/sb w-14 shrink-0 overflow-hidden border-r border-border bg-muted/30 transition-[width] duration-200 ease-out hover:w-62"
      aria-label="Hoofdnavigatie"
    >
      <nav className="px-2 py-4 transition-[padding] duration-200 group-hover/sb:px-4">
        <ul className="sidebar-nav flex flex-col gap-1" role="navigation" aria-label="Hoofdnavigatie">
          {SIDEBAR_NAV_ITEMS.map((item) => {
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
        </ul>
      </nav>
    </aside>
  );
}
