// ============================================================================
// GET  /api/expenses  — list expenses (filtered by category/date range/
//                        recurrence, searched by description, paginated).
//                        Also returns the sum of the filtered set so the UI
//                        can show a "Total" without a second round trip.
// POST /api/expenses  — log a new expense
//
// RBAC: expenses.view / expenses.create. Finance-owned data — no "own
// record" scoping, same as Invoices/Payments (see rbac.ts).
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

const createExpenseSchema = z.object({
  expense_date: z.string().optional(),
  category_id: z.string().uuid('A category is required'),
  vendor_id: z.string().uuid().optional().nullable(),
  amount: z.number().positive('Amount must be greater than zero'),
  currency: z.string().optional(),
  payment_method: z
    .enum(['bank_transfer', 'credit_card', 'debit_card', 'cash', 'cheque', 'online_wallet', 'other'])
    .optional()
    .nullable(),
  project_id: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  recurrence: z.enum(['one_time', 'recurring']).optional(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(EXPENSE_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const categoryId = searchParams.get('category_id');
  const recurrence = searchParams.get('recurrence');
  const from = searchParams.get('from'); // expense_date >= from
  const to = searchParams.get('to'); // expense_date <= to
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const db = supabaseServer();
  let query = db.from('expenses').select(EXPENSE_SELECT, { count: 'exact' });

  if (categoryId) query = query.eq('category_id', categoryId);
  if (recurrence) query = query.eq('recurrence', recurrence);
  if (from) query = query.gte('expense_date', from);
  if (to) query = query.lte('expense_date', to);
  if (search) query = query.ilike('description', `%${search}%`);

  query = query.order('expense_date', { ascending: false });

  const listFrom = (page - 1) * pageSize;
  const listTo = listFrom + pageSize - 1;
  query = query.range(listFrom, listTo);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load expenses.' }, { status: 500 });
  }

  // Sum across the *filtered* set (not just the current page) so the UI can
  // show an accurate total for whatever date range/category is selected.
  let sumQuery = db.from('expenses').select('amount');
  if (categoryId) sumQuery = sumQuery.eq('category_id', categoryId);
  if (recurrence) sumQuery = sumQuery.eq('recurrence', recurrence);
  if (from) sumQuery = sumQuery.gte('expense_date', from);
  if (to) sumQuery = sumQuery.lte('expense_date', to);
  if (search) sumQuery = sumQuery.ilike('description', `%${search}%`);
  const { data: sumRows } = await sumQuery;
  const totalAmount = (sumRows ?? []).reduce((sum, row: any) => sum + Number(row.amount), 0);

  return NextResponse.json({ expenses: data, total: count ?? 0, totalAmount, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(EXPENSE_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid expense data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();
  const { data: expense, error } = await db
    .from('expenses')
    .insert({
      expense_date: input.expense_date || new Date().toISOString().slice(0, 10),
      category_id: input.category_id,
      vendor_id: input.vendor_id || null,
      amount: input.amount,
      currency: input.currency || 'USD',
      payment_method: input.payment_method || null,
      project_id: input.project_id || null,
      description: input.description || null,
      recurrence: input.recurrence || 'one_time',
      created_by: user.id,
    })
    .select(EXPENSE_SELECT)
    .single();

  if (error || !expense) {
    return NextResponse.json({ error: 'Failed to log expense.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'expense',
    entity_id: expense.id,
    new_value: expense,
  });

  return NextResponse.json({ expense }, { status: 201 });
}
