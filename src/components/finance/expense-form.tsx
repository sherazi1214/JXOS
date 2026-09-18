'use client';

// ============================================================================
// ExpenseForm — modal to log a new expense or edit an existing one.
// Category is picked from the expense_categories catalog, with a quick
// "+ Add category" inline affordance so Finance doesn't need Settings
// access just to introduce a new category. Vendor/project linking is left
// out for now — the Vendors and Projects modules aren't built yet, so
// vendor_id/project_id stay null until those exist.
// ============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { EXPENSE_RECURRENCE_OPTIONS, PAYMENT_METHODS } from '@/lib/finance-constants';
import type { Expense, ExpenseCategory } from '@/types/database';
import type { ExpenseRow } from '@/components/finance/expense-table';

interface ExpenseFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (expense: Expense) => void;
  expense?: ExpenseRow | null;
}

export function ExpenseForm({ open, onClose, onSaved, expense }: ExpenseFormProps) {
  const isEdit = Boolean(expense);
  const [expenseDate, setExpenseDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [recurrence, setRecurrence] = useState<Expense['recurrence']>('one_time');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadCategories() {
    fetch('/api/expense-categories')
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));
  }

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNewCategory('');
    setAddingCategory(false);
    loadCategories();

    if (expense) {
      setExpenseDate(expense.expense_date);
      setCategoryId(expense.category_id);
      setAmount(String(expense.amount));
      setCurrency(expense.currency);
      setPaymentMethod(expense.payment_method || '');
      setRecurrence(expense.recurrence);
      setDescription(expense.description || '');
    } else {
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setCategoryId('');
      setAmount('');
      setCurrency('USD');
      setPaymentMethod('');
      setRecurrence('one_time');
      setDescription('');
    }
  }, [open, expense]);

  async function handleAddCategory() {
    if (!newCategory.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add category.');
        return;
      }
      setCategories((prev) => [...prev, data.category].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(data.category.id);
      setNewCategory('');
      setAddingCategory(false);
    } catch {
      setError('Network error while adding the category.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!categoryId) {
      setError('A category is required.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        expense_date: expenseDate,
        category_id: categoryId,
        amount: Number(amount),
        currency,
        payment_method: paymentMethod || null,
        recurrence,
        description: description.trim() || null,
      };

      const res = await fetch(isEdit ? `/api/expenses/${expense!.id}` : '/api/expenses', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      onSaved(data.expense);
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
      title={isEdit ? 'Edit Expense' : 'Log Expense'}
      size="md"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" loading={submitting}>
            {isEdit ? 'Save Changes' : 'Log Expense'}
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Date *</label>
            <input
              type="date"
              className={inputClass}
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Amount *</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.01"
                step="0.01"
                className={inputClass}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <input
                className={`${inputClass} w-16 shrink-0 text-center`}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>Category *</label>
          {addingCategory ? (
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="New category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                autoFocus
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddCategory} loading={submitting}>
                Add
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAddingCategory(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                className={inputClass}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="">Select a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddingCategory(true)}>
                + New
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Payment Method</label>
            <select
              className={inputClass}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="">Not specified</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              className={inputClass}
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Expense['recurrence'])}
            >
              {EXPENSE_RECURRENCE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className={inputClass}
            rows={2}
            placeholder="What was this expense for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
