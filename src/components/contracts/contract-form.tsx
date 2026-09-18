'use client';

// ============================================================================
// ContractForm — modal to create or edit a contract. Most contracts arrive
// as a draft via "Convert to Client" on a won lead; this covers manual
// creation (renewals, upsells sold outside the CRM pipeline) and editing
// afterward — e.g. moving a draft to active once signed.
// ============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { CONTRACT_STATUSES } from '@/lib/client-constants';
import type { Contract } from '@/types/database';

interface ClientOption {
  id: string;
  company_name: string;
  client_code: string;
}

interface ServiceOption {
  id: string;
  name: string;
}

interface ContractFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (contract: Contract) => void;
  contract?: Contract | null;
  defaultClientId?: string | null;
}

const EMPTY_FORM = {
  client_id: '',
  service_id: '',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '',
  contract_value: '',
  monthly_recurring_amt: '',
  currency: 'USD',
  payment_terms: '',
  renewal_terms: '',
  status: 'draft' as Contract['status'],
};

export function ContractForm({ open, onClose, onSaved, contract, defaultClientId }: ContractFormProps) {
  const isEdit = Boolean(contract);
  const [form, setForm] = useState(EMPTY_FORM);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      contract
        ? {
            client_id: contract.client_id,
            service_id: contract.service_id || '',
            start_date: contract.start_date,
            end_date: contract.end_date || '',
            contract_value: String(contract.contract_value),
            monthly_recurring_amt: String(contract.monthly_recurring_amt || ''),
            currency: contract.currency,
            payment_terms: contract.payment_terms || '',
            renewal_terms: contract.renewal_terms || '',
            status: contract.status,
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
  }, [open, contract, defaultClientId]);

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
    if (!form.contract_value.trim() || Number.isNaN(Number(form.contract_value))) {
      setError('Contract value must be a number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        ...form,
        service_id: form.service_id || null,
        end_date: form.end_date || null,
        contract_value: Number(form.contract_value),
        monthly_recurring_amt: form.monthly_recurring_amt ? Number(form.monthly_recurring_amt) : 0,
        payment_terms: form.payment_terms || null,
        renewal_terms: form.renewal_terms || null,
      };
      if (isEdit) delete payload.client_id;

      const res = await fetch(isEdit ? `/api/contracts/${contract!.id}` : '/api/contracts', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      onSaved(data.contract);
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
      title={isEdit ? `Edit ${contract?.contract_code}` : 'New Contract'}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="contract-form" loading={submitting}>
            {isEdit ? 'Save Changes' : 'Create Contract'}
          </Button>
        </>
      }
    >
      <form id="contract-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

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

        <div className="grid grid-cols-2 gap-4">
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
          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => update('status', e.target.value as Contract['status'])}
            >
              {CONTRACT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            <label className={labelClass}>End Date</label>
            <input
              type="date"
              className={inputClass}
              value={form.end_date}
              onChange={(e) => update('end_date', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Contract Value *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.contract_value}
              onChange={(e) => update('contract_value', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Monthly Recurring</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.monthly_recurring_amt}
              onChange={(e) => update('monthly_recurring_amt', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Currency</label>
            <input
              className={inputClass}
              value={form.currency}
              onChange={(e) => update('currency', e.target.value.toUpperCase())}
              maxLength={3}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Payment Terms</label>
          <input
            className={inputClass}
            placeholder="e.g. 50% upfront, 50% on delivery"
            value={form.payment_terms}
            onChange={(e) => update('payment_terms', e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Renewal Terms</label>
          <input
            className={inputClass}
            placeholder="e.g. Auto-renews monthly unless cancelled"
            value={form.renewal_terms}
            onChange={(e) => update('renewal_terms', e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
