'use client';

// ============================================================================
// InvoiceForm — modal to create an invoice (client, due date, dynamic line
// items) or edit header fields on an existing one. Line items are
// immutable once an invoice exists (see api/invoices/[id]/route.ts) — void
// and reissue instead of editing a sent invoice's items, so edit mode only
// exposes due date / tax / discount / status and shows items read-only.
// ============================================================================

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { INVOICE_STATUSES } from '@/lib/finance-constants';
import { formatCurrency } from '@/lib/utils';
import type { Invoice, InvoiceItem } from '@/types/database';

interface ClientOption {
  id: string;
  company_name: string;
  client_code: string;
}

interface ItemDraft {
  description: string;
  quantity: string;
  unit_price: string;
}

interface InvoiceFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (invoice: Invoice) => void;
  invoice?: (Invoice & { invoice_items?: InvoiceItem[] }) | null;
}

const EMPTY_ITEM: ItemDraft = { description: '', quantity: '1', unit_price: '' };

export function InvoiceForm({ open, onClose, onSaved, invoice }: InvoiceFormProps) {
  const isEdit = Boolean(invoice);
  const [clientId, setClientId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [taxAmount, setTaxAmount] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [status, setStatus] = useState<Invoice['status']>('draft');
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (invoice) {
      setClientId(invoice.client_id);
      setDueDate(invoice.due_date);
      setTaxAmount(String(invoice.tax_amount));
      setDiscountAmount(String(invoice.discount_amount));
      setCurrency(invoice.currency);
      setStatus(invoice.status);
      setItems(
        (invoice.invoice_items ?? []).map((it) => ({
          description: it.description,
          quantity: String(it.quantity),
          unit_price: String(it.unit_price),
        }))
      );
    } else {
      setClientId('');
      setDueDate('');
      setTaxAmount('0');
      setDiscountAmount('0');
      setCurrency('USD');
      setStatus('draft');
      setItems([{ ...EMPTY_ITEM }]);

      fetch('/api/clients?pageSize=100')
        .then((res) => (res.ok ? res.json() : { clients: [] }))
        .then((data) => setClients(data.clients ?? []))
        .catch(() => setClients([]));
    }
  }, [open, invoice]);

  function updateItem(index: number, key: keyof ItemDraft, value: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [key]: value } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );
  const total = subtotal + (Number(taxAmount) || 0) - (Number(discountAmount) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isEdit) {
      if (!clientId) {
        setError('A client is required.');
        return;
      }
      if (items.some((it) => !it.description.trim() || !it.unit_price)) {
        setError('Every line item needs a description and unit price.');
        return;
      }
    }
    if (!dueDate) {
      setError('Due date is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = isEdit
        ? {
            due_date: dueDate,
            tax_amount: Number(taxAmount) || 0,
            discount_amount: Number(discountAmount) || 0,
            status,
          }
        : {
            client_id: clientId,
            due_date: dueDate,
            tax_amount: Number(taxAmount) || 0,
            discount_amount: Number(discountAmount) || 0,
            currency,
            status,
            items: items.map((it) => ({
              description: it.description,
              quantity: Number(it.quantity) || 1,
              unit_price: Number(it.unit_price) || 0,
            })),
          };

      const res = await fetch(isEdit ? `/api/invoices/${invoice!.id}` : '/api/invoices', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      onSaved(data.invoice);
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
      title={isEdit ? `Edit ${invoice?.invoice_number}` : 'New Invoice'}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="invoice-form" loading={submitting}>
            {isEdit ? 'Save Changes' : 'Create Invoice'}
          </Button>
        </>
      }
    >
      <form id="invoice-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Client *</label>
            <select
              className={inputClass}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isEdit}
              required
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name} ({c.client_code})
                </option>
              ))}
              {isEdit && invoice?.client_id && (
                <option value={invoice.client_id}>{(invoice as any).client?.company_name}</option>
              )}
            </select>
          </div>
          <div>
            <label className={labelClass}>Due Date *</label>
            <input
              type="date"
              className={inputClass}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Line Items</label>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={`${inputClass} flex-1`}
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(i, 'description', e.target.value)}
                  disabled={isEdit}
                  required
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={`${inputClass} w-20`}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  disabled={isEdit}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputClass} w-28`}
                  placeholder="Unit price"
                  value={item.unit_price}
                  onChange={(e) => updateItem(i, 'unit_price', e.target.value)}
                  disabled={isEdit}
                  required
                />
                {!isEdit && items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="text-muted hover:text-danger p-1.5"
                    aria-label="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!isEdit && (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addItem}>
              <Plus size={14} />
              Add Line Item
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Tax</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={taxAmount}
              onChange={(e) => setTaxAmount(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Discount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Currency</label>
            <input
              className={inputClass}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              disabled={isEdit}
              maxLength={3}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as Invoice['status'])}
          >
            {INVOICE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted">Subtotal {formatCurrency(subtotal, currency)}</span>
          <span className="font-semibold text-white">Total {formatCurrency(total, currency)}</span>
        </div>
      </form>
    </Modal>
  );
}
