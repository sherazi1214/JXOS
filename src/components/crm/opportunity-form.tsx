'use client';

// ============================================================================
// OpportunityForm — modal to open/edit an opportunity. When leadId is
// passed in (e.g. from the lead detail page), the lead is locked; otherwise
// a small search-as-you-type combobox lets the user pick the lead it
// belongs to (the API also enforces that you can only open opportunities on
// leads you're allowed to touch).
// ============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import type { Opportunity } from '@/types/database';

interface LeadOption {
  id: string;
  company_name: string;
  lead_code: string;
}

interface EmployeeOption {
  id: string;
  full_name: string;
  employee_code: string;
}

interface OpportunityFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (opportunity: Opportunity) => void;
  leadId?: string;
  leadLabel?: string; // e.g. "Acme Inc. (LD-XXXX)" shown when leadId is locked
  opportunity?: Opportunity | null; // present => edit mode
  canAssign: boolean;
}

const EMPTY_FORM = {
  name: '',
  value: '',
  currency: 'USD',
  probability_pct: '20',
  expected_close_date: '',
  owner_id: '',
};

export function OpportunityForm({
  open,
  onClose,
  onSaved,
  leadId,
  leadLabel,
  opportunity,
  canAssign,
}: OpportunityFormProps) {
  const isEdit = Boolean(opportunity);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState<LeadOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      opportunity
        ? {
            name: opportunity.name,
            value: String(opportunity.value),
            currency: opportunity.currency,
            probability_pct: String(opportunity.probability_pct),
            expected_close_date: opportunity.expected_close_date || '',
            owner_id: opportunity.owner_id || '',
          }
        : EMPTY_FORM
    );
    setSelectedLead(null);
    setLeadSearch('');
    setLeadResults([]);
    setError(null);

    if (canAssign) {
      fetch('/api/employees')
        .then((res) => (res.ok ? res.json() : { employees: [] }))
        .then((data) => setEmployees(data.employees ?? []))
        .catch(() => setEmployees([]));
    }
  }, [open, opportunity, canAssign]);

  // Lead search-as-you-type, only used when no leadId was passed in.
  useEffect(() => {
    if (leadId || !open || !leadSearch.trim()) {
      setLeadResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/leads?search=${encodeURIComponent(leadSearch.trim())}&pageSize=6`)
        .then((res) => (res.ok ? res.json() : { leads: [] }))
        .then((data) => setLeadResults(data.leads ?? []))
        .catch(() => setLeadResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [leadSearch, leadId, open]);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Opportunity name is required.');
      return;
    }
    if (!form.value || Number(form.value) < 0) {
      setError('Enter a valid value.');
      return;
    }
    const effectiveLeadId = leadId || selectedLead?.id;
    if (!isEdit && !effectiveLeadId) {
      setError('Pick the lead this opportunity belongs to.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        name: form.name,
        value: Number(form.value),
        currency: form.currency,
        probability_pct: Number(form.probability_pct),
        expected_close_date: form.expected_close_date || null,
        owner_id: canAssign ? form.owner_id || null : undefined,
      };
      if (!isEdit) payload.lead_id = effectiveLeadId;

      const res = await fetch(
        isEdit ? `/api/opportunities/${opportunity!.id}` : '/api/opportunities',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      onSaved(data.opportunity);
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
      title={isEdit ? `Edit ${opportunity?.name}` : 'New Opportunity'}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="opportunity-form" loading={submitting}>
            {isEdit ? 'Save Changes' : 'Create Opportunity'}
          </Button>
        </>
      }
    >
      <form id="opportunity-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        {!isEdit && !leadId && (
          <div>
            <label className={labelClass}>Lead *</label>
            {selectedLead ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white">
                <span>
                  {selectedLead.company_name}{' '}
                  <span className="text-muted">({selectedLead.lead_code})</span>
                </span>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-white"
                  onClick={() => setSelectedLead(null)}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className={inputClass}
                  placeholder="Search leads by company name…"
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                />
                {leadResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-xl max-h-48 overflow-y-auto">
                    {leadResults.map((l) => (
                      <button
                        type="button"
                        key={l.id}
                        onClick={() => {
                          setSelectedLead(l);
                          setLeadResults([]);
                        }}
                        className="block w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5"
                      >
                        {l.company_name} <span className="text-muted">({l.lead_code})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {leadId && leadLabel && (
          <div>
            <label className={labelClass}>Lead</label>
            <div className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white">
              {leadLabel}
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Opportunity Name *</label>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Website Redesign Package"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Value *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.value}
              onChange={(e) => update('value', e.target.value)}
              placeholder="10000"
              required
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
          <div>
            <label className={labelClass}>Probability (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              className={inputClass}
              value={form.probability_pct}
              onChange={(e) => update('probability_pct', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Expected Close Date</label>
            <input
              type="date"
              className={inputClass}
              value={form.expected_close_date}
              onChange={(e) => update('expected_close_date', e.target.value)}
            />
          </div>
          {canAssign && (
            <div className="col-span-2">
              <label className={labelClass}>Owner</label>
              <select
                className={inputClass}
                value={form.owner_id}
                onChange={(e) => update('owner_id', e.target.value)}
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
      </form>
    </Modal>
  );
}
