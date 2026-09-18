'use client';

// ============================================================================
// LeadActivityTimeline — read-only feed of calls/emails/notes/follow-ups
// logged against a lead, newest first. Purely presentational; the "log
// activity" form lives alongside it in the detail page.
// ============================================================================

import { Phone, Mail, MessageCircle, Users, StickyNote, Clock, FileText, ArrowRightLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { LeadActivity, LeadActivityType } from '@/types/database';

export interface ActivityRow extends LeadActivity {
  performed_by_employee?: { id: string; full_name: string } | null;
}

const ACTIVITY_ICON: Record<LeadActivityType, LucideIcon> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: Users,
  note: StickyNote,
  follow_up: Clock,
  proposal: FileText,
  status_change: ArrowRightLeft,
};

export function LeadActivityTimeline({
  activities,
  loading,
}: {
  activities: ActivityRow[];
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-muted py-4">Loading activity…</p>;
  }

  if (activities.length === 0) {
    return <p className="text-sm text-muted py-4">No activity logged yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {activities.map((activity) => {
        const Icon = ACTIVITY_ICON[activity.activity_type] ?? StickyNote;
        return (
          <li key={activity.id} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1 pb-4 border-b border-border last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-white capitalize">
                  {activity.activity_type.replace('_', ' ')}
                </span>
                <span className="text-xs text-muted whitespace-nowrap">
                  {formatDate(activity.occurred_at)}
                </span>
              </div>
              {activity.summary && (
                <p className="text-sm text-muted mt-1 break-words">{activity.summary}</p>
              )}
              {activity.performed_by_employee?.full_name && (
                <p className="text-[11px] text-muted mt-1">
                  by {activity.performed_by_employee.full_name}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
