'use client';

// ============================================================================
// AttendanceCorrectionForm — modal for HR/Admin (attendance.update) to fix
// a record: missed check-out, wrong status, mark a day as leave/holiday,
// etc. Working hours are recalculated server-side from whatever check-in/
// check-out ends up set (see PATCH /api/attendance).
// ============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { ATTENDANCE_STATUSES } from '@/lib/hr-constants';
import type { AttendanceRecord } from '@/types/database';

interface AttendanceCorrectionFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (record: AttendanceRecord) => void;
  record: AttendanceRecord | null;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function AttendanceCorrectionForm({
  open,
  onClose,
  onSaved,
  record,
}: AttendanceCorrectionFormProps) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [status, setStatus] = useState<AttendanceRecord['status']>('present');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !record) return;
    setCheckIn(toLocalInput(record.check_in));
    setCheckOut(toLocalInput(record.check_out));
    setStatus(record.status);
    setNotes(record.notes || '');
    setError(null);
  }, [open, record]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!record) return;
    setError(null);

    if (checkIn && checkOut && checkOut < checkIn) {
      setError('Check-out cannot be before check-in.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          check_in: checkIn ? new Date(checkIn).toISOString() : null,
          check_out: checkOut ? new Date(checkOut).toISOString() : null,
          status,
          notes: notes || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      onSaved(data.attendance);
      onClose();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary placeholder:text-muted';
  const labelClass = 'block text-xs text-muted mb-1.5';

  if (!record) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Correct Attendance — ${record.attendance_date}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="attendance-correction-form" loading={submitting}>
            Save Changes
          </Button>
        </>
      }
    >
      <form id="attendance-correction-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Check In</label>
            <input
              type="datetime-local"
              className={inputClass}
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Check Out</label>
            <input
              type="datetime-local"
              className={inputClass}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as AttendanceRecord['status'])}
          >
            {ATTENDANCE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            className={inputClass}
            rows={2}
            placeholder="Reason for correction…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
