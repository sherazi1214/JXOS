'use client';

// ============================================================================
// PaymentsPageClient — read-only, company-wide list of every payment
// recorded against any invoice. Recording happens from the Invoices page
// (POST /api/invoices/:id/payments); this page is just the ledger view,
// same data source as the CEO dashboard's revenue figures.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/lib/finance-constants';

interface PaymentRow {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  client: { id: string; company_name: string } | null;
  invoice: { id: string; invoice_number: string } | null;
}

const PAGE_SIZE = 25;

export function PaymentsPageClient() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/payments?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load payments.');
        return;
      }
      setPayments(data.payments ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrorMsg('Network error while loading payments.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Payments</h1>
        <p className="text-sm text-muted mt-0.5">
          {total} payment{total === 1 ? '' : 's'} recorded · This page {formatCurrency(totalAmount)}
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableEmpty colSpan={6}>Loading payments…</TableEmpty>
            ) : payments.length === 0 ? (
              <TableEmpty colSpan={6}>No payments recorded yet.</TableEmpty>
            ) : (
              payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted whitespace-nowrap">{formatDate(p.payment_date)}</TableCell>
                  <TableCell>{p.client?.company_name || '—'}</TableCell>
                  <TableCell>{p.invoice?.invoice_number || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="muted">
                      {PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label ?? p.payment_method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted">{p.reference || '—'}</TableCell>
                  <TableCell className="font-medium text-white">{formatCurrency(p.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
