// ============================================================================
// GET    /api/employees/:id  — fetch a single employee
// PATCH  /api/employees/:id  — edit an employee's record
// DELETE /api/employees/:id  — soft-delete (offboard) an employee
//
// RBAC: employees.view (own record via users.employee_id, unless
// employees.view_all) / employees.update / employees.delete.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, EMPLOYEE_PERMISSIONS } from '@/lib/rbac';

const EMPLOYEE_SELECT = `
  *,
  department:departments!department_id(id, name),
  manager:employees!manager_id(id, full_name)
`;

const updateEmployeeSchema = z.object({
  full_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  designation: z.string().optional().nullable(),
  manager_id: z.string().uuid().optional().nullable(),
  joining_date: z.string().min(1).optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  base_salary: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  status: z.enum(['active', 'on_leave', 'suspended', 'terminated']).optional(),
  bank_name: z.string().optional().nullable(),
  bank_account_number: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
});

async function loadContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);

  const db = supabaseServer();
  const { data: existing, error } = await db
    .from('employees')
    .select(EMPLOYEE_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !existing) {
    return { error: NextResponse.json({ error: 'Employee not found.' }, { status: 404 }) };
  }

  return { user, db, permissions, existing: existing as Record<string, any> };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, permissions, existing } = ctx;

  const isOwnRecord = user.employee_id === resolvedParams.id;
  if (!permissions.includes(EMPLOYEE_PERMISSIONS.VIEW_ALL) && !isOwnRecord) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ employee: existing });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  if (!permissions.includes(EMPLOYEE_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid employee data.' },
      { status: 400 }
    );
  }

  const { data: updated, error } = await db
    .from('employees')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', resolvedParams.id)
    .select(EMPLOYEE_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json(
      {
        error: error?.code === '23505' ? 'An employee with this email already exists.' : 'Failed to update employee.',
      },
      { status: error?.code === '23505' ? 409 : 500 }
    );
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'employee',
    entity_id: resolvedParams.id,
    previous_value: existing,
    new_value: updated,
  });

  return NextResponse.json({ employee: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  if (!permissions.includes(EMPLOYEE_PERMISSIONS.DELETE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { error } = await db
    .from('employees')
    .update({ deleted_at: new Date().toISOString(), status: 'terminated' })
    .eq('id', resolvedParams.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to remove employee.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'employee',
    entity_id: resolvedParams.id,
    previous_value: existing,
  });

  return NextResponse.json({ success: true });
}