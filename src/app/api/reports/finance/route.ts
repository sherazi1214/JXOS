// ============================================================================
// GET /api/reports/finance?months=6  — Finance dashboard/reports data:
//
//   - months[]           revenue (payments collected), expenses, invoiced
//                         amount and profit, one row per calendar month for
//                         the trailing `months` window (default 6, max 24)
//   - totals             sums of the above across the window, plus
//                         outstanding receivables (computed across ALL
//                         non-cancelled invoices, not just the window —
//                         money owed doesn't expire from view just because
//                         the invoice is older than the report range)
//   - expenseByCategory  breakdown of the window's expenses by category,
//                         for the "biggest expenses" question in the brief
//
// This aggregates in JS rather than SQL because Supabase's JS client can't
// express GROUP BY — acceptable at this data volume (internal ERP), same
// pattern already used for outstanding-balance math on the Invoices page.
//
// RBAC: requires both expenses.view AND invoices.view_all — this report
// crosses both ledgers, so (by the 0004 seed migration) only CEO/Admin and
// Finance can reach it.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, EXPENSE_PERMISSIONS, INVOICE_PERMISSIONS } from '@/lib/rbac';

function monthKey(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const parts = key.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (
    !permissions.includes(EXPENSE_PERMISSIONS.VIEW) ||
    !permissions.includes(INVOICE_PERMISSIONS.VIEW_ALL)
  ) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const months = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get('months')) || 6));

  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const windowStartStr = windowStart.toISOString().slice(0, 10);

  const db = supabaseServer();

  const [{ data: payments, error: paymentsError }, { data: expenses, error: expensesError }, { data: invoices, error: invoicesError }, { data: receivableInvoices, error: receivablesError }] =
    await Promise.all([
      db.from('payments').select('amount, payment_date').gte('payment_date', windowStartStr),
      db
        .from('expenses')
        .select('amount, expense_date, category:expense_categories(name)')
        .gte('expense_date', windowStartStr),
      db
        .from('invoices')
        .select('total_amount, invoice_date')
        .is('deleted_at', null)
        .gte('invoice_date', windowStartStr),
      db
        .from('invoices')
        .select('total_amount, status, payments(amount)')
        .is('deleted_at', null)
        .neq('status', 'cancelled'),
    ]);

  if (paymentsError || expensesError || invoicesError || receivablesError) {
    return NextResponse.json({ error: 'Failed to load financial report data.' }, { status: 500 });
  }

  // Build the trailing month buckets up front so months with no activity
  // still show up as zero rather than being skipped.
  const buckets = new Map<string, { revenue: number; expenses: number; invoiced: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() + i, 1));
    buckets.set(monthKey(d), { revenue: 0, expenses: 0, invoiced: 0 });
  }

  for (const p of payments ?? []) {
    const bucket = buckets.get(monthKey(p.payment_date));
    if (bucket) bucket.revenue += Number(p.amount);
  }

  const categoryTotals = new Map<string, number>();
  for (const e of expenses ?? []) {
    const bucket = buckets.get(monthKey(e.expense_date));
    if (bucket) bucket.expenses += Number(e.amount);
    const categoryName = (e as any).category?.name ?? 'Uncategorized';
    categoryTotals.set(categoryName, (categoryTotals.get(categoryName) ?? 0) + Number(e.amount));
  }

  for (const inv of invoices ?? []) {
    const bucket = buckets.get(monthKey(inv.invoice_date));
    if (bucket) bucket.invoiced += Number(inv.total_amount);
  }

  const monthRows = Array.from(buckets.entries()).map(([key, v]) => ({
    month: key,
    label: monthLabel(key),
    revenue: v.revenue,
    expenses: v.expenses,
    invoiced: v.invoiced,
    profit: v.revenue - v.expenses,
  }));

  const outstandingReceivables = (receivableInvoices ?? []).reduce((sum, inv: any) => {
    const paid = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    return sum + Math.max(0, Number(inv.total_amount) - paid);
  }, 0);

  const totalRevenue = monthRows.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = monthRows.reduce((s, m) => s + m.expenses, 0);
  const totalInvoiced = monthRows.reduce((s, m) => s + m.invoiced, 0);

  const expenseByCategory = Array.from(categoryTotals.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return NextResponse.json({
    months: monthRows,
    totals: {
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit: totalRevenue - totalExpenses,
      invoiced: totalInvoiced,
      outstandingReceivables,
    },
    expenseByCategory,
  });
}
