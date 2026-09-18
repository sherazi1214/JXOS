'use client';

// ============================================================================
// Sidebar — primary navigation. Items are filtered by the current user's
// role so, e.g., an Employee never even sees a "Finance" link. This is a
// UX convenience only: the real access check happens server-side on each
// page/API route via rbac.ts — hiding a link here is not a security
// boundary by itself.
// ============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users2,
  Building2,
  FolderKanban,
  Wallet,
  UserCog,
  Banknote,
  Boxes,
  Target,
  Bot,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLES } from '@/lib/rbac';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: string[] | 'all';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: 'all' },
  {
    label: 'CRM',
    href: '/crm/leads',
    icon: Users2,
    roles: [ROLES.CEO_ADMIN, ROLES.SALES_MANAGER, ROLES.SALESPERSON],
  },
  {
    label: 'Clients',
    href: '/clients',
    icon: Building2,
    roles: [ROLES.CEO_ADMIN, ROLES.SALES_MANAGER, ROLES.SALESPERSON, ROLES.PROJECT_MANAGER],
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: FolderKanban,
    roles: [ROLES.CEO_ADMIN, ROLES.PROJECT_MANAGER, ROLES.EMPLOYEE],
  },
  {
    label: 'Finance',
    href: '/finance/invoices',
    icon: Wallet,
    roles: [ROLES.CEO_ADMIN, ROLES.FINANCE],
  },
  {
    label: 'HR',
    href: '/hr/employees',
    icon: UserCog,
    roles: [ROLES.CEO_ADMIN, ROLES.HR],
  },
  {
    label: 'Payroll',
    href: '/payroll',
    icon: Banknote,
    roles: [ROLES.CEO_ADMIN, ROLES.HR, ROLES.FINANCE],
  },
  {
    label: 'Vendors',
    href: '/vendors',
    icon: Boxes,
    roles: [ROLES.CEO_ADMIN, ROLES.FINANCE],
  },
  {
    label: 'KPIs',
    href: '/kpis',
    icon: Target,
    roles: [ROLES.CEO_ADMIN, ROLES.SALES_MANAGER],
  },
  { label: 'AI Assistant', href: '/ai-assistant', icon: Bot, roles: 'all' },
  { label: 'Settings', href: '/settings', icon: Settings, roles: [ROLES.CEO_ADMIN] },
];

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles === 'all' || item.roles.includes(role)
  );

  return (
    <aside className="glass w-64 shrink-0 border-r-0 flex flex-col relative z-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 to-transparent" />

      <div className="relative flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white font-bold text-sm shadow-glow transition-transform duration-300 hover:scale-105 hover:rotate-3">
          J
        </span>
        <div>
          <p className="font-display text-sm font-semibold text-white leading-none tracking-tight">Jasonex OS</p>
          <p className="text-[10.5px] text-muted leading-none mt-1">Business Operating System</p>
        </div>
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 space-y-0.5 pb-3">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'text-white bg-gradient-to-r from-primary/20 to-primary/0 ring-1 ring-inset ring-primary/25'
                  : 'text-muted hover:bg-white/5 hover:text-white hover:translate-x-0.5'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gradient shadow-glow" />
              )}
              <Icon
                size={17}
                className={cn('shrink-0 transition-colors', isActive ? 'text-primary-light' : 'text-muted group-hover:text-white')}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-border px-3 py-3.5">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {role.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] text-muted leading-none">Signed in as</p>
            <p className="text-sm text-white truncate leading-none mt-1">{role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
