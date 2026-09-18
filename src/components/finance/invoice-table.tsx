'use client';

// ============================================================================
// InvoiceTable — presentational table of invoices. Outstanding balance is
// computed client-side from total_amount − sum(payments), same formula the
// DB comment in schema.sql documents (derived, never stored, to avoid drift).
// ============================================================================

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { INVOICE_STATUS_BADGE_VARIANT } from '@/lib/finance-constants';
import { capitalize, formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice } from '@/types/database';

export interface InvoiceRow extends Invoice {
  client?: { id: string; company_name: string; client_code: string } | null;
  payments?: { id: string; amount: number }[];
}

function outstandingBalance(invoice: InvoiceRow): number {
  const paid = (invoice.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  return Math.max(0, Number(invoice.total_amount) - paid);
}

export function InvoiceTable({
  invoices,
  loading,
  onRowClick,
  onRecordPayment,
  canRecordPayment,
}: {
  invoices: InvoiceRow[];
  loading: boolean;
  onRowClick: (invoice: InvoiceRow) => void;
  onRecordPayment?: (invoice: InvoiceRow) => void;
  canRecordPayment?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Outstanding</TableHead>
          <TableHead>Status</TableHead>
          {canRecordPayment && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableEmpty colSpan={canRecordPayment ? 7 : 6}>Loading invoices…</TableEmpty>
        ) : invoices.length === 0 ? (
          <TableEmpty colSpan={canRecordPayment ? 7 : 6}>No invoices match your filters.</TableEmpty>
        ) : (
          invoices.map((invoice) => {
            const outstanding = outstandingBalance(invoice);
            const isOverdue =
              invoice.status !== 'paid' &&
              invoice.status !== 'cancelled' &&
              new Date(invoice.due_date) < new Date();

            return (
              <TableRow key={invoice.id} onClick={() => onRowClick(invoice)}>
                <TableCell>
                  <span className="font-medium">{invoice.invoice_number}</span>
                  <span className="block text-xs text-muted">{formatDate(invoice.invoice_date)}</span>
                </TableCell>
                <TableCell className="text-muted">{invoice.client?.company_name || '—'}</TableCell>
                <TableCell className={isOverdue ? 'text-danger' : 'text-muted'}>
                  {formatDate(invoice.due_date)}
                </TableCell>
                <TableCell className="text-muted">
                  {formatCurrency(invoice.total_amount, invoice.currency)}
                </TableCell>
                <TableCell className={outstanding > 0 ? 'text-warning' : 'text-muted'}>
                  {formatCurrency(outstanding, invoice.currency)}
                </TableCell>
                <TableCell>
                  <Badge variant={INVOICE_STATUS_BADGE_VARIANT[invoice.status]}>
                    {capitalize(invoice.status.replace('_', ' '))}
                  </Badge>
                </TableCell>
                {canRecordPayment && (
                  <TableCell>
                    {outstanding > 0 && invoice.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRecordPayment?.(invoice);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Record Payment
                      </button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
