// ============================================================================
// GET    /api/expenses/:id  — fetch a single expense
// PATCH  /api/expenses/:id  — edit an expense
// DELETE /api/expenses/:id  — permanently delete an expense (expenses are
//                              simple ledger entries with no downstream
//                              records depending on them, unlike invoices —
//                              a hard delete is fine, mirrored in audit_logs)
//
// RBAC: expenses.view / expenses.update / expenses.delete.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, EXPENSE_PERMISSIONS } from '@/lib/rbac';

const EXPENSE_SELECT = `
  *,
  category:expense_categories(id, name),
  vendor:vendors(id, name)
`;

const updateExpenseSchema = z.object({
  expense_date: z.string().min(1).optional(),
  category_id: z.string().uuid().optional(),
  vendor_id: z.string().uuid().optional().nullable(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  payment_method: z
    .enum(['bank_transfer', 'credit_card', 'debit_card', 'cash', 'cheque', 'online_wallet', 'other'])
    .optional()
    .nullable(),
  project_id: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  recurrence: z.enum(['one_time', 'recurring']).optional(),
});

async function loadContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);

  const db = supabaseServer();
  const { data: existing, error } = await db
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('id', id)
    .single();

  if (error || !existing) {
    return { error: NextResponse.json({ error: 'Expense not found.' }, { status: 404 }) };
  }

  return { user, db, permissions, existing: existing as Record<string, any> };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { permissions, existing } = ctx;

  if (!permissions.includes(EXPENSE_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ expense: existing });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  if (!permissions.includes(EXPENSE_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid expense data.' },
      { status: 400 }
    );
  }

  const { data: updated, error } = await db
    .from('expenses')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', resolvedParams.id)
    .select(EXPENSE_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update expense.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'expense',
    entity_id: resolvedParams.id,
    previous_value: existing,
    new_value: updated,
  });

  return NextResponse.json({ expense: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  if (!permissions.includes(EXPENSE_PERMISSIONS.DELETE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { error } = await db.from('expenses').delete().eq('id', resolvedParams.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete expense.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'expense',
    entity_id: resolvedParams.id,
    previous_value: existing,
  });

  return NextResponse.json({ success: true });
}
