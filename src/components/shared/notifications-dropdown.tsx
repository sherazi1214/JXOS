'use client';

// ============================================================================
// Notifications bell + dropdown. Fetches from /api/notifications, marks a
// notification read on click (optimistic, with a "Mark all read" shortcut),
// and navigates to link_url when a notification has one.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link_url: string | null;
  created_at: string;
  read_at: string | null;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications ?? []);
        setUnreadCount(data.unread_count ?? 0);
      }
    } catch {
      // Offline or a transient error — fail quietly, bell just stays as-is.
    } finally {
      setIsLoading(false);
    }
  }

  // Poll for unread notifications periodically, even while closed, so the
  // badge count stays fresh without the user having to open the panel.
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleOpen() {
    const next = !isOpen;
    setIsOpen(next);
    if (next) loadNotifications();
  }

  async function markRead(item: NotificationItem) {
    if (!item.read_at) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id }),
        });
      } catch {
        // Best-effort — a failed mark-as-read isn't worth interrupting
        // navigation over; it'll just show unread again next refresh.
      }
    }
    if (item.link_url) {
      setIsOpen(false);
      router.push(item.link_url);
    }
  }

  async function markAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // Best-effort — see markRead above.
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-surface shadow-xl z-50">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-white">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-muted">Loading…</p>
            )}

            {!isLoading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-muted">No new notifications</p>
            )}

            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => markRead(item)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-white/[0.03] transition-colors',
                  !item.read_at && 'bg-primary/5'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-white">{item.title}</p>
                  {!item.read_at && (
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </div>
                {item.body && <p className="text-xs text-muted mt-0.5">{item.body}</p>}
                <p className="text-[11px] text-muted mt-1">{timeAgo(item.created_at)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
