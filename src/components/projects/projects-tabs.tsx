'use client';

// ============================================================================
// ProjectsTabs — small in-section tab bar for switching between the Projects
// list and the My Tasks board. Same pattern as CrmTabs/FinanceTabs.
// ============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Projects', href: '/projects' },
  { label: 'My Tasks', href: '/projects/tasks' },
];

export function ProjectsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-border">
      {TABS.map((tab) => {
        const active =
          tab.href === '/projects' ? pathname === '/projects' : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              active
                ? 'border-primary text-white'
                : 'border-transparent text-muted hover:text-white'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
