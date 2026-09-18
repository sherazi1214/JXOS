'use client';

// ============================================================================
// PaymentForm — modal to record a payment against a specific invoice.
// Shows the current outstanding balance and defaults the amount to it, so
// the common case (paying an invoice off in full) is a single click.
// ============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { PAYMENT_METHODS } from '@/lib/finance-constants';
import { formatCurrency } from '@/lib/utils';
import type { Payment } from '@/types/database';

interface PaymentFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (payment: Payment, invoiceStatus: string) => void;
  invoiceId: string;
  invoiceNumber: string;
  currency: string;
  outstanding: number;
}

export function PaymentForm({
  open,
  onClose,
  onSaved,
  invoiceId,
  invoiceNumber,
  currency,
  outstanding,
}: PaymentFormProps) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<Payment['payment_method']>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(outstanding > 0 ? String(outstanding) : '');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('bank_transfer');
    setReference('');
    setNotes('');
    setError(null);
  }, [open, outstanding]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numericAmount,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          reference: reference || null,
          notes: notes || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      onSaved(data.payment, data.invoice_status);
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
      title={`Record Payment — ${invoiceNumber}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" loading={submitting}>
            Record Payment
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        <p className="text-xs text-muted">
          Outstanding balance: <span className="text-white">{formatCurrency(outstanding, currency)}</span>
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Amount *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Payment Date *</label>
            <input
              type="date"
              className={inputClass}
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Payment Method *</label>
          <select
            className={inputClass}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as Payment['payment_method'])}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Reference / Transaction #</label>
          <input
            className={inputClass}
            placeholder="e.g. bank transaction ID"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            className={inputClass}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
