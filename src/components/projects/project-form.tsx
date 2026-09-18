'use client';

// ============================================================================
// ProjectForm — modal to create or edit a project. Manual creation for now;
// later a won opportunity/contract can pre-fill this instead.
// ============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { PROJECT_STATUSES, PROJECT_PRIORITIES } from '@/lib/project-constants';
import type { ProjectRecord } from '@/types/database';

interface ClientOption {
  id: string;
  company_name: string;
  client_code: string;
}
interface ServiceOption {
  id: string;
  name: string;
}
interface EmployeeOption {
  id: string;
  full_name: string;
  employee_code: string;
}

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (project: ProjectRecord) => void;
  project?: ProjectRecord | null;
  defaultClientId?: string | null;
}

const EMPTY_FORM = {
  client_id: '',
  service_id: '',
  name: '',
  project_manager_id: '',
  start_date: new Date().toISOString().slice(0, 10),
  deadline: '',
  budget: '',
  revenue: '',
  cost: '',
  status: 'planning' as ProjectRecord['status'],
  priority: 'medium' as ProjectRecord['priority'],
};

export function ProjectForm({ open, onClose, onSaved, project, defaultClientId }: ProjectFormProps) {
  const isEdit = Boolean(project);
  const [form, setForm] = useState(EMPTY_FORM);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      project
        ? {
            client_id: project.client_id,
            service_id: project.service_id || '',
            name: project.name,
            project_manager_id: project.project_manager_id || '',
            start_date: project.start_date,
            deadline: project.deadline || '',
            budget: String(project.budget || ''),
            revenue: String(project.revenue || ''),
            cost: String(project.cost || ''),
            status: project.status,
            priority: project.priority,
          }
        : { ...EMPTY_FORM, client_id: defaultClientId || '' }
    );
    setError(null);

    fetch('/api/clients?pageSize=100')
      .then((res) => (res.ok ? res.json() : { clients: [] }))
      .then((data) => setClients(data.clients ?? []))
      .catch(() => setClients([]));

    fetch('/api/services')
      .then((res) => (res.ok ? res.json() : { services: [] }))
      .then((data) => setServices(data.services ?? []))
      .catch(() => setServices([]));

    fetch('/api/employees?pageSize=100')
      .then((res) => (res.ok ? res.json() : { employees: [] }))
      .then((data) => setEmployees(data.employees ?? []))
      .catch(() => setEmployees([]));
  }, [open, project, defaultClientId]);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isEdit && !form.client_id) {
      setError('A client is required.');
      return;
    }
    if (!form.name.trim()) {
      setError('Project name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        ...form,
        service_id: form.service_id || null,
        project_manager_id: form.project_manager_id || null,
        deadline: form.deadline || null,
        budget: form.budget ? Number(form.budget) : 0,
        revenue: form.revenue ? Number(form.revenue) : 0,
        cost: form.cost ? Number(form.cost) : 0,
      };
      if (isEdit) delete payload.client_id;

      const res = await fetch(isEdit ? `/api/projects/${project!.id}` : '/api/projects', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      onSaved(data.project);
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
      title={isEdit ? `Edit ${project?.project_code}` : 'New Project'}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" loading={submitting}>
            {isEdit ? 'Save Changes' : 'Create Project'}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className={labelClass}>Project Name *</label>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. Acme Corp — Website Redesign"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Client *</label>
            <select
              className={inputClass}
              value={form.client_id}
              onChange={(e) => update('client_id', e.target.value)}
              disabled={isEdit}
              required
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name} ({c.client_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Service</label>
            <select
              className={inputClass}
              value={form.service_id}
              onChange={(e) => update('service_id', e.target.value)}
            >
              <option value="">—</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Project Manager</label>
            <select
              className={inputClass}
              value={form.project_manager_id}
              onChange={(e) => update('project_manager_id', e.target.value)}
            >
              <option value="">Unassigned</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} ({e.employee_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Priority</label>
            <select
              className={inputClass}
              value={form.priority}
              onChange={(e) => update('priority', e.target.value as ProjectRecord['priority'])}
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
            <label className={labelClass}>Start Date *</label>
            <input
              type="date"
              className={inputClass}
              value={form.start_date}
              onChange={(e) => update('start_date', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Deadline</label>
            <input
              type="date"
              className={inputClass}
              value={form.deadline}
              onChange={(e) => update('deadline', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => update('status', e.target.value as ProjectRecord['status'])}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Budget</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.budget}
              onChange={(e) => update('budget', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Revenue</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.revenue}
              onChange={(e) => update('revenue', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Cost</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.cost}
              onChange={(e) => update('cost', e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted -mt-2">
          Profit is calculated automatically as revenue minus cost.
        </p>
      </form>
    </Modal>
  );
}
