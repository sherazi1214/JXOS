// ============================================================================
// GET  /api/employees  — list the employee roster (filtered by department/
//                         status, searched by name/email/code, paginated)
// POST /api/employees  — add a new employee
//
// RBAC: employees.view / employees.view_all / employees.create. Without
// employees.view_all (e.g. a plain Employee role), a user only ever sees
// their own record — enforced here on the server, not just hidden in the
// UI, same pattern as /api/leads.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, EMPLOYEE_PERMISSIONS } from '@/lib/rbac';

const EMPLOYEE_SELECT = `
  *,
  department:departments!department_id(id, name),
  manager:employees!manager_id(id, full_name, employee_code)
`;

const createEmployeeSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('A valid email is required'),
  phone: z.string().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  designation: z.string().optional().nullable(),
  manager_id: z.string().uuid().optional().nullable(),
  joining_date: z.string().min(1, 'Joining date is required'),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  base_salary: z.coerce.number().nonnegative().optional(),
  currency: z.string().optional(),
  bank_name: z.string().optional().nullable(),
  bank_account_number: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  status: z.enum(['active', 'on_leave', 'suspended', 'terminated']).optional(),
});

function generateEmployeeCode(): string {
  return `JT-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(EMPLOYEE_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAll = permissions.includes(EMPLOYEE_PERMISSIONS.VIEW_ALL);

  const { searchParams } = req.nextUrl;
  const departmentId = searchParams.get('department_id');
  const status = searchParams.get('status');
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const db = supabaseServer();
  let query = db.from('employees').select(EMPLOYEE_SELECT, { count: 'exact' }).is('deleted_at', null);

  if (!canViewAll) {
    // No roster access — you only ever see your own record.
    query = query.eq('id', user.employee_id ?? '__none__');
  } else {
    if (departmentId) query = query.eq('department_id', departmentId);
    if (status) query = query.eq('status', status);
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,employee_code.ilike.%${search}%`
      );
    }
  }

  query = query.order('full_name', { ascending: true });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load employees.' }, { status: 500 });
  }

  return NextResponse.json({ employees: data, total: count ?? 0, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(EMPLOYEE_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid employee data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();
  const { data: employee, error } = await db
    .from('employees')
    .insert({
      employee_code: generateEmployeeCode(),
      full_name: input.full_name,
      email: input.email,
      phone: input.phone || null,
      department_id: input.department_id || null,
      designation: input.designation || null,
      manager_id: input.manager_id || null,
      joining_date: input.joining_date,
      employment_type: input.employment_type || 'full_time',
      base_salary: input.base_salary ?? 0,
      currency: input.currency || 'USD',
      bank_name: input.bank_name || null,
      bank_account_number: input.bank_account_number || null,
      emergency_contact_name: input.emergency_contact_name || null,
      emergency_contact_phone: input.emergency_contact_phone || null,
      status: input.status || 'active',
    })
    .select(EMPLOYEE_SELECT)
    .single();

  if (error || !employee) {
    return NextResponse.json(
      {
        error:
          error?.code === '23505'
            ? 'An employee with this email already exists.'
            : 'Failed to create employee.',
      },
      { status: error?.code === '23505' ? 409 : 500 }
    );
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'employee',
    entity_id: employee.id,
    new_value: employee,
  });

  return NextResponse.json({ employee }, { status: 201 });
}