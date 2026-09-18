'use client';

// ============================================================================
// ClientForm — modal to create or edit a client. Most clients arrive via
// "Convert to Client" on a won lead (see crm/lead-detail-client.tsx); this
// covers manual creation and editing core fields afterward.
// ============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { CLIENT_STATUSES } from '@/lib/client-constants';
import type { Client } from '@/types/database';

interface EmployeeOption {
  id: string;
  full_name: string;
  employee_code: string;
}

interface ClientFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (client: Client) => void;
  client?: Client | null;
  canAssign: boolean;
}

const EMPTY_FORM = {
  company_name: '',
  country: '',
  industry: '',
  account_manager_id: '',
  status: 'active' as Client['status'],
  notes: '',
};

export function ClientForm({ open, onClose, onSaved, client, canAssign }: ClientFormProps) {
  const isEdit = Boolean(client);
  const [form, setForm] = useState(EMPTY_FORM);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      client
        ? {
            company_name: client.company_name,
            country: client.country || '',
            industry: client.industry || '',
            account_manager_id: client.account_manager_id || '',
            status: client.status,
            notes: client.notes || '',
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
  }, [open, client, canAssign]);

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
        account_manager_id: canAssign ? form.account_manager_id || null : undefined,
      };

      const res = await fetch(isEdit ? `/api/clients/${client!.id}` : '/api/clients', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      onSaved(data.client);
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
      title={isEdit ? `Edit ${client?.company_name}` : 'New Client'}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="client-form" loading={submitting}>
            {isEdit ? 'Save Changes' : 'Create Client'}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className={labelClass}>Company Name *</label>
          <input
            className={inputClass}
            value={form.company_name}
            onChange={(e) => update('company_name', e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Country</label>
            <input
              className={inputClass}
              value={form.country}
              onChange={(e) => update('country', e.target.value)}
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
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => update('status', e.target.value as Client['status'])}
            >
              {CLIENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {canAssign && (
            <div>
              <label className={labelClass}>Account Manager</label>
              <select
                className={inputClass}
                value={form.account_manager_id}
                onChange={(e) => update('account_manager_id', e.target.value)}
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
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            className={inputClass}
            rows={3}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
