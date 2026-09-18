'use client';

// ============================================================================
// LeadActivityForm — inline form to log a call/email/note/follow-up against
// a lead. When the type is "follow_up", an extra date field lets the user
// set the lead's next scheduled follow-up in the same action.
// ============================================================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LEAD_ACTIVITY_TYPES } from '@/lib/crm-constants';
import type { LeadActivityType } from '@/types/database';

export function LeadActivityForm({
  leadId,
  onLogged,
}: {
  leadId: string;
  onLogged: () => void;
}) {
  const [activityType, setActivityType] = useState<LeadActivityType>('call');
  const [summary, setSummary] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    'w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary placeholder:text-muted';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!summary.trim()) {
      setError('Add a short note about what happened.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_type: activityType,
          summary: summary.trim(),
          next_follow_up_at:
            activityType === 'follow_up' && nextFollowUp
              ? new Date(nextFollowUp).toISOString()
              : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to log activity.');
        return;
      }

      setSummary('');
      setNextFollowUp('');
      onLogged();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        <select
          className={inputClass + ' w-40 shrink-0'}
          value={activityType}
          onChange={(e) => setActivityType(e.target.value as LeadActivityType)}
        >
          {LEAD_ACTIVITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          placeholder="What happened? e.g. Called, discussed pricing, will send proposal Friday."
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      {activityType === 'follow_up' && (
        <div>
          <label className="block text-xs text-muted mb-1.5">Next follow-up date</label>
          <input
            type="datetime-local"
            className={inputClass}
            value={nextFollowUp}
            onChange={(e) => setNextFollowUp(e.target.value)}
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={submitting}>
          Log Activity
        </Button>
      </div>
    </form>
  );
}
