'use client';

// ============================================================================
// TaskForm — modal to add a task to a project. A manager (projects.update
// holder) can assign it to anyone on the team; a plain Employee can only
// add a task for themselves — the assignee field is hidden for them since
// the API silently forces it to their own employee_id anyway.
// ============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { PROJECT_PRIORITIES } from '@/lib/project-constants';
import type { ProjectPriority } from '@/types/database';

interface MemberOption {
  employee_id: string;
  employee?: { id: string; full_name: string; employee_code: string } | null;
}

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  projectId: string;
  members: MemberOption[];
  canAssignOthers: boolean;
}

const EMPTY_FORM = {
  name: '',
  description: '',
  assigned_to: '',
  priority: 'medium' as ProjectPriority,
  start_date: '',
  due_date: '',
  estimated_hours: '',
};

export function TaskForm({ open, onClose, onSaved, projectId, members, canAssignOthers }: TaskFormProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setError(null);
  }, [open]);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Task name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        project_id: projectId,
        name: form.name,
        description: form.description || null,
        priority: form.priority,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      };
      if (canAssignOthers) payload.assigned_to = form.assigned_to || null;

      const res = await fetch('/api/tasks', {
        method: 'POST',
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Task"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" loading={submitting}>
            Add Task
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className={labelClass}>Task Name *</label>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. Set up staging environment"
            required
          />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className={inputClass}
            rows={2}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {canAssignOthers && (
            <div>
              <label className={labelClass}>Assign To</label>
              <select
                className={inputClass}
                value={form.assigned_to}
                onChange={(e) => update('assigned_to', e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.employee_id} value={m.employee_id}>
                    {m.employee?.full_name || 'Team member'}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelClass}>Priority</label>
            <select
              className={inputClass}
              value={form.priority}
              onChange={(e) => update('priority', e.target.value as ProjectPriority)}
            >
              {PROJECT_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Start Date</label>
            <input
              type="date"
              className={inputClass}
              value={form.start_date}
              onChange={(e) => update('start_date', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Due Date</label>
            <input
              type="date"
              className={inputClass}
              value={form.due_date}
              onChange={(e) => update('due_date', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Est. Hours</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className={inputClass}
              value={form.estimated_hours}
              onChange={(e) => update('estimated_hours', e.target.value)}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
