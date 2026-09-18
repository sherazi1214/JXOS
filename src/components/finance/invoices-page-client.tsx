'use client';

// ============================================================================
// InvoicesPageClient — interactive shell for /finance/invoices: search +
// status filter, table, pagination, "New Invoice" modal, and per-row
// "Record Payment" modal. Same structure as ClientsPageClient/
// ContractsPageClient for consistency.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InvoiceTable, type InvoiceRow } from '@/components/finance/invoice-table';
import { InvoiceForm } from '@/components/finance/invoice-form';
import { PaymentForm } from '@/components/finance/payment-form';
import { INVOICE_STATUSES } from '@/lib/finance-constants';
import { usePermissions } from '@/hooks/use-permissions';
import { INVOICE_PERMISSIONS, PAYMENT_PERMISSIONS } from '@/lib/rbac';

const PAGE_SIZE = 20;

function outstandingBalance(invoice: InvoiceRow): number {
  const paid = (invoice.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  return Math.max(0, Number(invoice.total_amount) - paid);
}

export function InvoicesPageClient() {
  const { can, loading: authLoading } = usePermissions();

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<InvoiceRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);

      const res = await fetch(`/api/invoices?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load invoices.');
        setInvoices([]);
        setTotal(0);
        return;
      }

      setInvoices(data.invoices ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg('Network error while loading invoices.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timeout = setTimeout(fetchInvoices, 300);
    return () => clearTimeout(timeout);
  }, [fetchInvoices]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectClass =
    'rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary';
  const canRecordPayment = can(PAYMENT_PERMISSIONS.CREATE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Invoices</h1>
          <p className="text-sm text-muted mt-0.5">
            {total} invoice{total === 1 ? '' : 's'}
          </p>
        </div>
        {!authLoading && can(INVOICE_PERMISSIONS.CREATE) && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} />
            New Invoice
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search invoice number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-primary"
          />
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{errorMsg}</p>
        )}

        <InvoiceTable
          invoices={invoices}
          loading={loading}
          onRowClick={(invoice) => {
            setEditing(invoice);
            setFormOpen(true);
          }}
          onRecordPayment={(invoice) => setPayingInvoice(invoice)}
          canRecordPayment={canRecordPayment}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <InvoiceForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchInvoices()}
        invoice={editing}
      />

      {payingInvoice && (
        <PaymentForm
          open={Boolean(payingInvoice)}
          onClose={() => setPayingInvoice(null)}
          onSaved={() => fetchInvoices()}
          invoiceId={payingInvoice.id}
          invoiceNumber={payingInvoice.invoice_number}
          currency={payingInvoice.currency}
          outstanding={outstandingBalance(payingInvoice)}
        />
      )}
    </div>
  );
}
