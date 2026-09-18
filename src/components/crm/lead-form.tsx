'use client';

// ============================================================================
// LeadForm — modal used both to create a new lead and to edit an existing
// one. Renders the "assign to" field only for roles that hold
// leads.assign (checked server-side too — the API silently drops the field
// for anyone else, this is just to avoid showing a control that won't do
// anything).
// ============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { LEAD_SOURCES, LEAD_STAGES, LEAD_PRIORITIES } from '@/lib/crm-constants';
import type { Lead } from '@/types/database';

interface EmployeeOption {
  id: string;
  full_name: string;
  employee_code: string;
}

interface LeadFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
  lead?: Lead | null; // present => edit mode
  canAssign: boolean;
}

const EMPTY_FORM = {
  company_name: '',
  contact_person: '',
  email: '',
  phone: '',
  country: '',
  city: '',
  industry: '',
  website: '',
  source: LEAD_SOURCES[0],
  campaign: '',
  service_interested: '',
  lead_value: '',
  currency: 'USD',
  stage: 'new' as Lead['stage'],
  priority: 'medium' as Lead['priority'],
  assigned_to: '',
  next_follow_up_at: '',
  notes: '',
};

function toDatetimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LeadForm({ open, onClose, onSaved, lead, canAssign }: LeadFormProps) {
  const isEdit = Boolean(lead);
  const [form, setForm] = useState(EMPTY_FORM);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setForm(
      lead
        ? {
            company_name: lead.company_name,
            contact_person: lead.contact_person || '',
            email: lead.email || '',
            phone: lead.phone || '',
            country: lead.country || '',
            city: lead.city || '',
            industry: lead.industry || '',
            website: lead.website || '',
            source: lead.source,
            campaign: lead.campaign || '',
            service_interested: lead.service_interested || '',
            lead_value: lead.lead_value != null ? String(lead.lead_value) : '',
            currency: lead.currency,
            stage: lead.stage,
            priority: lead.priority,
            assigned_to: lead.assigned_to || '',
            next_follow_up_at: toDatetimeLocal(lead.next_follow_up_at),
            notes: lead.notes || '',
          }
        : EMPTY_FORM
    );
    setError(null);

    if (canAssign) {
      fetch('/api/employees')
        .then((res) => (res.ok ? res.json() : { employees: [] }))
        .then((data) => setEmployees(data.employees ?? []))
        .catch(() => setEmployees([]));
    }
  }, [open, lead, canAssign]);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.company_name.trim()) {
      setError('Company name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        ...form,
        lead_value: form.lead_value ? Number(form.lead_value) : null,
        next_follow_up_at: form.next_follow_up_at
          ? new Date(form.next_follow_up_at).toISOString()
          : null,
        assigned_to: canAssign ? form.assigned_to || null : undefined,
      };

      const res = await fetch(isEdit ? `/api/leads/${lead!.id}` : '/api/leads', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      onSaved(data.lead);
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
      title={isEdit ? `Edit ${lead?.company_name}` : 'Add New Lead'}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="lead-form" loading={submitting}>
            {isEdit ? 'Save Changes' : 'Create Lead'}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Company Name *</label>
            <input
              className={inputClass}
              value={form.company_name}
              onChange={(e) => update('company_name', e.target.value)}
              placeholder="Acme Inc."
              required
            />
          </div>
          <div>
            <label className={labelClass}>Contact Person</label>
            <input
              className={inputClass}
              value={form.contact_person}
              onChange={(e) => update('contact_person', e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="jane@acme.com"
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="+1 555 000 0000"
            />
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <input
              className={inputClass}
              value={form.country}
              onChange={(e) => update('country', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input
              className={inputClass}
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Industry</label>
            <input
              className={inputClass}
              value={form.industry}
              onChange={(e) => update('industry', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Website</label>
            <input
              className={inputClass}
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
              placeholder="acme.com"
            />
          </div>

          <div>
            <label className={labelClass}>Source *</label>
            <select
              className={inputClass}
              value={form.source}
              onChange={(e) => update('source', e.target.value)}
            >
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Campaign</label>
            <input
              className={inputClass}
              value={form.campaign}
              onChange={(e) => update('campaign', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Service Interested In</label>
            <input
              className={inputClass}
              value={form.service_interested}
              onChange={(e) => update('service_interested', e.target.value)}
              placeholder="Website Development"
            />
          </div>
          <div>
            <label className={labelClass}>Lead Value (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.lead_value}
              onChange={(e) => update('lead_value', e.target.value)}
              placeholder="5000"
            />
          </div>

          <div>
            <label className={labelClass}>Stage</label>
            <select
              className={inputClass}
              value={form.stage}
              onChange={(e) => update('stage', e.target.value as Lead['stage'])}
            >
              {LEAD_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Priority</label>
            <select
              className={inputClass}
              value={form.priority}
              onChange={(e) => update('priority', e.target.value as Lead['priority'])}
            >
              {LEAD_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {canAssign && (
            <div>
              <label className={labelClass}>Assigned Salesperson</label>
              <select
                className={inputClass}
                value={form.assigned_to}
                onChange={(e) => update('assigned_to', e.target.value)}
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelClass}>Next Follow-up</label>
            <input
              type="datetime-local"
              className={inputClass}
              value={form.next_follow_up_at}
              onChange={(e) => update('next_follow_up_at', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            className={inputClass}
            rows={3}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Anything the next person following up should know…"
          />
        </div>
      </form>
    </Modal>
  );
}
