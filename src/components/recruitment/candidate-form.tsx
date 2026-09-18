'use client';

// ============================================================================
// CandidateForm — modal to add a new candidate application, or edit stage /
// score / offer details for an existing one. Same pattern as EmployeeForm.
// ============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { RECRUITMENT_STAGES } from '@/lib/recruitment-constants';
import type { Department } from '@/types/database';
import type { CandidateRow } from '@/components/recruitment/candidate-table';

interface CandidateFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  candidate?: CandidateRow | null;
}

export function CandidateForm({ open, onClose, onSaved, candidate }: CandidateFormProps) {
  const isEdit = Boolean(candidate);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [positionTitle, setPositionTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [source, setSource] = useState('');
  const [stage, setStage] = useState<CandidateRow['stage']>('application');
  const [interviewScore, setInterviewScore] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [offeredSalary, setOfferedSalary] = useState('');
  const [notes, setNotes] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetch('/api/departments')
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]));

    if (candidate) {
      setFullName(candidate.full_name);
      setEmail(candidate.email || '');
      setPhone(candidate.phone || '');
      setPositionTitle(candidate.position_title);
      setDepartmentId(candidate.department_id || '');
      setSource(candidate.source || '');
      setStage(candidate.stage);
      setInterviewScore(candidate.interview_score != null ? String(candidate.interview_score) : '');
      setExpectedSalary(candidate.expected_salary != null ? String(candidate.expected_salary) : '');
      setOfferedSalary(candidate.offered_salary != null ? String(candidate.offered_salary) : '');
      setNotes(candidate.notes || '');
    } else {
      setFullName('');
      setEmail('');
      setPhone('');
      setPositionTitle('');
      setDepartmentId('');
      setSource('');
      setStage('application');
      setInterviewScore('');
      setExpectedSalary('');
      setOfferedSalary('');
      setNotes('');
    }
  }, [open, candidate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !positionTitle.trim()) {
      setError('Full name and position are required.');
      return;
    }

    setSubmitting(true);
    try {
      const basePayload = {
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        position_title: positionTitle.trim(),
        department_id: departmentId || null,
        source: source.trim() || null,
      };

      const payload = isEdit
        ? {
            ...basePayload,
            stage,
            interview_score: interviewScore ? Number(interviewScore) : null,
            expected_salary: expectedSalary ? Number(expectedSalary) : null,
            offered_salary: offeredSalary ? Number(offeredSalary) : null,
            notes: notes.trim() || null,
          }
        : { ...basePayload, expected_salary: expectedSalary ? Number(expectedSalary) : null, notes: notes.trim() || null };

      const res = await fetch(isEdit ? `/api/recruitment/${candidate!.id}` : '/api/recruitment', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      onSaved();
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
  const editableStages = RECRUITMENT_STAGES.filter((s) => s.value !== 'hired');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${candidate?.full_name}` : 'Add Candidate'}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="candidate-form" loading={submitting}>
            {isEdit ? 'Save Changes' : 'Add Candidate'}
          </Button>
        </>
      }
    >
      <form id="candidate-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Full Name *</label>
            <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Position *</label>
            <input
              className={inputClass}
              value={positionTitle}
              onChange={(e) => setPositionTitle(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Department</label>
            <select className={inputClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Source</label>
            <input
              className={inputClass}
              placeholder="LinkedIn, referral, job board…"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
        </div>

        {isEdit && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Stage</label>
              <select
                className={inputClass}
                value={stage}
                onChange={(e) => setStage(e.target.value as CandidateRow['stage'])}
              >
                {editableStages.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Interview Score (0–10)</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                className={inputClass}
                value={interviewScore}
                onChange={(e) => setInterviewScore(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Offered Salary</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={offeredSalary}
                onChange={(e) => setOfferedSalary(e.target.value)}
              />
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Expected Salary</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            value={expectedSalary}
            onChange={(e) => setExpectedSalary(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}
