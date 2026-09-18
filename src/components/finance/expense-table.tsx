'use client';

// ============================================================================
// ExpenseTable — presentational table of logged expenses. Same shape as
// InvoiceTable for consistency across the Finance module.
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
import { EXPENSE_RECURRENCE_BADGE_VARIANT } from '@/lib/finance-constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Expense } from '@/types/database';

export interface ExpenseRow extends Expense {
  category?: { id: string; name: string } | null;
  vendor?: { id: string; name: string } | null;
}

export function ExpenseTable({
  expenses,
  loading,
  onRowClick,
  onDelete,
  canDelete,
}: {
  expenses: ExpenseRow[];
  loading: boolean;
  onRowClick: (expense: ExpenseRow) => void;
  onDelete?: (expense: ExpenseRow) => void;
  canDelete?: boolean;
}) {
  const colCount = canDelete ? 7 : 6;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Vendor</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Type</TableHead>
          {canDelete && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableEmpty colSpan={colCount}>Loading expenses…</TableEmpty>
        ) : expenses.length === 0 ? (
          <TableEmpty colSpan={colCount}>No expenses match your filters.</TableEmpty>
        ) : (
          expenses.map((expense) => (
            <TableRow key={expense.id} onClick={() => onRowClick(expense)}>
              <TableCell className="text-muted whitespace-nowrap">
                {formatDate(expense.expense_date)}
              </TableCell>
              <TableCell>{expense.description || '—'}</TableCell>
              <TableCell className="text-muted">{expense.category?.name || '—'}</TableCell>
              <TableCell className="text-muted">{expense.vendor?.name || '—'}</TableCell>
              <TableCell className="font-medium">
                {formatCurrency(expense.amount, expense.currency)}
              </TableCell>
              <TableCell>
                <Badge variant={EXPENSE_RECURRENCE_BADGE_VARIANT[expense.recurrence]}>
                  {expense.recurrence === 'recurring' ? 'Recurring' : 'One-Time'}
                </Badge>
              </TableCell>
              {canDelete && (
                <TableCell>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(expense);
                    }}
                    className="text-xs text-danger hover:underline"
                  >
                    Delete
                  </button>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
