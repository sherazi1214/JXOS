// ============================================================================
// GET  /api/expense-categories  — category catalog (Office Rent, Software,
//                                  Salaries, ...), used by the Expenses form
// POST /api/expense-categories  — add a new category to the catalog
//
// Shared reference data, same shape as /api/services. Any authenticated
// user can read it; only expenses.create holders can extend it, since the
// Expenses module is the one that curates it.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, EXPENSE_PERMISSIONS } from '@/lib/rbac';

const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const db = supabaseServer();
  const { data, error } = await db
    .from('expense_categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to load expense categories.' }, { status: 500 });
  }

  return NextResponse.json({ categories: data });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(EXPENSE_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid category data.' },
      { status: 400 }
    );
  }

  const db = supabaseServer();
  const { data: category, error } = await db
    .from('expense_categories')
    .insert({ name: parsed.data.name })
    .select('*')
    .single();

  if (error || !category) {
    return NextResponse.json(
      {
        error:
          error?.code === '23505'
            ? 'A category with this name already exists.'
            : 'Failed to create category.',
      },
      { status: error?.code === '23505' ? 409 : 500 }
    );
  }

  return NextResponse.json({ category }, { status: 201 });
}
