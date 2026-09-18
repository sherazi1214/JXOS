'use client';

// ============================================================================
// Topbar — global search (UI shell for now), notifications, and the user
// menu (profile + logout). Logout calls the API to clear the httpOnly
// cookie, then sends the user back to /login.
// ============================================================================

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronDown, LogOut, UserRound } from 'lucide-react';
import NotificationsDropdown from '@/components/shared/notifications-dropdown';
import { useOnClickOutside } from '@/hooks/use-on-click-outside';

interface TopbarUser {
  name: string;
  role: string;
  avatarUrl: string | null;
}

export default function Topbar({ user }: { user: TopbarUser }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(menuRef, () => setMenuOpen(false));

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="glass sticky top-0 z-30 flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-2 w-full max-w-md rounded-xl border border-border bg-background/60 px-3 py-2 transition-all duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-background/80">
        <Search size={16} className="text-muted" />
        <input
          type="text"
          placeholder="Search anything…"
          className="w-full bg-transparent text-sm text-white placeholder:text-muted outline-none"
        />
        <kbd className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-2">
        <NotificationsDropdown />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                {initials}
              </span>
            )}
            <span className="hidden sm:block text-left">
              <span className="block text-sm text-white leading-none">{user.name}</span>
              <span className="block text-[11px] text-muted leading-none mt-0.5">
                {user.role}
              </span>
            </span>
            <ChevronDown size={14} className="text-muted" />
          </button>

          {menuOpen && (
            <div className="glass absolute right-0 mt-2 w-48 rounded-xl shadow-xl z-50 py-1 animate-pop-in">
              <a
                href="/settings"
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-white"
              >
                <UserRound size={15} />
                Profile & Settings
              </a>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
              >
                <LogOut size={15} />
                {loggingOut ? 'Logging out…' : 'Logout'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
