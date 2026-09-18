'use client';

// ============================================================================
// AttendanceWidget — self-service check-in/check-out card. Shows today's
// record for the signed-in employee and a single action button that flips
// between "Check In" and "Check Out" depending on state. A live elapsed
// timer runs while checked in so the working-hours number isn't a mystery
// until check-out.
// ============================================================================

import { useEffect, useState } from 'react';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ATTENDANCE_STATUS_BADGE_VARIANT } from '@/lib/hr-constants';
import { capitalize } from '@/lib/utils';
import type { AttendanceRecord } from '@/types/database';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso)
  );
}

function elapsedSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function AttendanceWidget({ onChanged }: { onChanged?: () => void }) {
  const [today, setToday] = useState<AttendanceRecord | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const todayDate = new Date().toISOString().slice(0, 10);

  async function fetchToday() {
    try {
      const res = await fetch(`/api/attendance?from=${todayDate}&to=${todayDate}&pageSize=1`);
      const data = await res.json();
      if (!res.ok) {
        setToday(null);
        return;
      }
      setToday(data.attendance?.[0] ?? null);
    } catch {
      setToday(null);
    }
  }

  useEffect(() => {
    fetchToday();
  }, []);

  // Tick every 30s to keep the elapsed-time display live while checked in.
  useEffect(() => {
    if (!today?.check_in || today.check_out) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, [today]);

  async function handleAction(action: 'check_in' | 'check_out') {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setToday(data.attendance);
      onChanged?.();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (today === undefined) {
    return (
      <Card>
        <p className="text-sm text-muted">Loading today&apos;s attendance…</p>
      </Card>
    );
  }

  const hasCheckedIn = Boolean(today?.check_in);
  const hasCheckedOut = Boolean(today?.check_out);

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Today&apos;s Attendance</p>
            {!hasCheckedIn && <p className="text-xs text-muted mt-0.5">You haven&apos;t checked in yet.</p>}
            {hasCheckedIn && !hasCheckedOut && (
              <p className="text-xs text-muted mt-0.5">
                Checked in at {formatTime(today!.check_in)} · {elapsedSince(today!.check_in as string)} elapsed
              </p>
            )}
            {hasCheckedOut && (
              <p className="text-xs text-muted mt-0.5">
                {formatTime(today!.check_in)} – {formatTime(today!.check_out)} ·{' '}
                {today!.working_hours ?? 0}h worked
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {today?.status && (
            <Badge variant={ATTENDANCE_STATUS_BADGE_VARIANT[today.status]}>
              {capitalize(today.status.replace('_', ' '))}
            </Badge>
          )}
          {!hasCheckedIn && (
            <Button onClick={() => handleAction('check_in')} loading={submitting}>
              <LogIn size={16} />
              Check In
            </Button>
          )}
          {hasCheckedIn && !hasCheckedOut && (
            <Button variant="outline" onClick={() => handleAction('check_out')} loading={submitting}>
              <LogOut size={16} />
              Check Out
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mt-3">{error}</p>}
    </Card>
  );
}
