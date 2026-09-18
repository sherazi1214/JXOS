// ============================================================================
// GET  /api/departments  — department catalog, used by the Employees form
//                           (and later Expenses/Projects department fields)
// POST /api/departments  — add a new department
//
// Shared reference data, same shape as /api/services and
// /api/expense-categories. Any authenticated user can read it; only
// employees.create holders can extend it.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, EMPLOYEE_PERMISSIONS } from '@/lib/rbac';

const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  description: z.string().optional().nullable(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const db = supabaseServer();
  const { data, error } = await db.from('departments').select('*').order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to load departments.' }, { status: 500 });
  }

  return NextResponse.json({ departments: data });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(EMPLOYEE_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createDepartmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid department data.' },
      { status: 400 }
    );
  }

  const db = supabaseServer();
  const { data: department, error } = await db
    .from('departments')
    .insert({ name: parsed.data.name, description: parsed.data.description || null })
    .select('*')
    .single();

  if (error || !department) {
    return NextResponse.json(
      {
        error:
          error?.code === '23505'
            ? 'A department with this name already exists.'
            : 'Failed to create department.',
      },
      { status: error?.code === '23505' ? 409 : 500 }
    );
  }

  return NextResponse.json({ department }, { status: 201 });
}
