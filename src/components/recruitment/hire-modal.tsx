'use client';

// ============================================================================
// HireModal — converts a candidate into an Employee record via
// POST /api/recruitment/:id/hire. Same "convert" idea as the CRM module's
// Lead -> Client flow: this is the pipeline's finish line, so it asks only
// for what the Employee Master needs that the candidate record doesn't
// already have (joining date, employment type).
// ============================================================================

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { EMPLOYMENT_TYPES } from '@/lib/hr-constants';
import type { CandidateRow } from '@/components/recruitment/candidate-table';

export function HireModal({
  open,
  onClose,
  onHired,
  candidate,
}: {
  open: boolean;
  onClose: () => void;
  onHired: () => void;
  candidate: CandidateRow | null;
}) {
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().slice(0, 10));
  const [employmentType, setEmploymentType] = useState('full_time');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!candidate) return null;

  async function handleHire() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/recruitment/${candidate!.id}/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joining_date: joiningDate, employment_type: employmentType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to hire this candidate.');
        return;
      }
      onHired();
      onClose();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary';
  const labelClass = 'block text-xs text-muted mb-1.5';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Hire ${candidate.full_name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleHire} loading={submitting}>
            Create Employee Record
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        <p className="text-sm text-muted">
          This creates an Employee record for <span className="text-white">{candidate.full_name}</span> as{' '}
          {candidate.position_title}, at{' '}
          {candidate.offered_salary != null
            ? candidate.offered_salary
            : candidate.expected_salary != null
              ? `${candidate.expected_salary} (expected — no offer on file)`
              : '0 (no salary on file)'}
          , and marks this candidate as Hired.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Joining Date *</label>
            <input
              type="date"
              className={inputClass}
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Employment Type</label>
            <select className={inputClass} value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!candidate.email && (
          <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
            This candidate has no email on file — add one first (Employee records require it).
          </p>
        )}
      </div>
    </Modal>
  );
}
