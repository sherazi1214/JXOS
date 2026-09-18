'use client';

// ============================================================================
// ExpensesPageClient — interactive shell for /finance/expenses: date range +
// category filters, running total, table, pagination, "Log Expense" modal.
// Same structure as InvoicesPageClient for consistency.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ExpenseTable, type ExpenseRow } from '@/components/finance/expense-table';
import { ExpenseForm } from '@/components/finance/expense-form';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { EXPENSE_PERMISSIONS } from '@/lib/rbac';
import type { ExpenseCategory } from '@/types/database';

const PAGE_SIZE = 20;

export function ExpensesPageClient() {
  const { can, loading: authLoading } = usePermissions();

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState<ExpenseRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (categoryId) params.set('category_id', categoryId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const res = await fetch(`/api/expenses?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load expenses.');
        setExpenses([]);
        setTotal(0);
        setTotalAmount(0);
        return;
      }

      setExpenses(data.expenses ?? []);
      setTotal(data.total ?? 0);
      setTotalAmount(data.totalAmount ?? 0);
    } catch {
      setErrorMsg('Network error while loading expenses.');
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId, from, to]);

  useEffect(() => {
    const timeout = setTimeout(fetchExpenses, 300);
    return () => clearTimeout(timeout);
  }, [fetchExpenses]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryId, from, to]);

  useEffect(() => {
    fetch('/api/expense-categories')
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));
  }, [formOpen]);

  async function handleDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/expenses/${deleting.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleting(null);
        fetchExpenses();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to delete expense.');
        setDeleting(null);
      }
    } catch {
      setErrorMsg('Network error while deleting the expense.');
      setDeleting(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectClass =
    'rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Expenses</h1>
          <p className="text-sm text-muted mt-0.5">
            {total} expense{total === 1 ? '' : 's'} · Total {formatCurrency(totalAmount)}
          </p>
        </div>
        {!authLoading && can(EXPENSE_PERMISSIONS.CREATE) && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} />
            Log Expense
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-primary"
          />
          <select className={selectClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            className={selectClass}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="From date"
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            className={selectClass}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="To date"
          />
        </div>

        {errorMsg && (
          <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{errorMsg}</p>
        )}

        <ExpenseTable
          expenses={expenses}
          loading={loading}
          onRowClick={(expense) => {
            setEditing(expense);
            setFormOpen(true);
          }}
          onDelete={(expense) => setDeleting(expense)}
          canDelete={can(EXPENSE_PERMISSIONS.DELETE)}
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

      <ExpenseForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchExpenses()}
        expense={editing}
      />

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleting(null)} aria-hidden />
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface shadow-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Delete this expense?</h2>
            <p className="text-sm text-muted">
              {deleting.description || 'This expense'} of {formatCurrency(deleting.amount, deleting.currency)} will
              be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
