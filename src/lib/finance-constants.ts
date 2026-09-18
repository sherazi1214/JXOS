// ============================================================================
// Finance domain constants — labels and badge-color mapping for Invoices
// and Payments, mirroring the shape of client-constants.ts / crm-constants.ts.
// ============================================================================

import type { ExpenseRecurrence, InvoiceStatus, PaymentMethod } from '@/types/database';
import type { BadgeVariant } from '@/components/ui/badge';

export const INVOICE_STATUSES: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const INVOICE_STATUS_BADGE_VARIANT: Record<InvoiceStatus, BadgeVariant> = {
  draft: 'muted',
  sent: 'primary',
  partially_paid: 'warning',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'muted',
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online_wallet', label: 'Online Wallet' },
  { value: 'other', label: 'Other' },
];

export const EXPENSE_RECURRENCE_OPTIONS: { value: ExpenseRecurrence; label: string }[] = [
  { value: 'one_time', label: 'One-Time' },
  { value: 'recurring', label: 'Recurring' },
];

export const EXPENSE_RECURRENCE_BADGE_VARIANT: Record<ExpenseRecurrence, BadgeVariant> = {
  one_time: 'muted',
  recurring: 'primary',
};
