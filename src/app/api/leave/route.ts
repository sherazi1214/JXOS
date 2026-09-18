// ============================================================================
// GET  /api/leave  — list leave requests (own, or all with leave.view_all)
// POST /api/leave  — submit a new leave request for the current employee
//
// RBAC: leave.view / leave.view_all / leave.create (see src/lib/rbac.ts).
// Same own-record scoping pattern as /api/attendance: without
// leave.view_all a user only ever sees requests tied to their own
// employee_id, regardless of what employee_id they pass in.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, LEAVE_PERMISSIONS } from '@/lib/rbac';

const LEAVE_SELECT = `
  *,
  employee:employees(id, employee_code, full_name, department_id),
  approver:approved_by(id, full_name)
`;

/** Inclusive calendar-day count between two ISO dates, e.g. Mon-Fri = 5. */
function inclusiveDayCount(startDate: string, endDate: string): number {
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(LEAVE_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAll = permissions.includes(LEAVE_PERMISSIONS.VIEW_ALL);

  const { searchParams } = req.nextUrl;
  const employeeIdParam = searchParams.get('employee_id');
  const status = searchParams.get('status');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const db = supabaseServer();
  let query = db.from('leave_requests').select(LEAVE_SELECT, { count: 'exact' });

  if (canViewAll) {
    if (employeeIdParam) query = query.eq('employee_id', employeeIdParam);
  } else {
    if (!user.employee_id) {
      return NextResponse.json({ leave_requests: [], total: 0, page, pageSize });
    }
    query = query.eq('employee_id', user.employee_id);
  }

  if (status) query = query.eq('status', status);
  query = query.order('created_at', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load leave requests.' }, { status: 500 });
  }

  return NextResponse.json({ leave_requests: data, total: count ?? 0, page, pageSize });
}

const createLeaveSchema = z
  .object({
    leave_type: z.string().min(1, 'Leave type is required'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
    reason: z.string().optional().nullable(),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: 'End date must be on or after the start date.',
    path: ['end_date'],
  });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(LEAVE_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!user.employee_id) {
    return NextResponse.json(
      { error: 'This account is not linked to an employee record.' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createLeaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid leave request.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();
  const { data: request_, error } = await db
    .from('leave_requests')
    .insert({
      employee_id: user.employee_id,
      leave_type: input.leave_type,
      start_date: input.start_date,
      end_date: input.end_date,
      days_count: inclusiveDayCount(input.start_date, input.end_date),
      reason: input.reason || null,
      status: 'pending',
    })
    .select(LEAVE_SELECT)
    .single();

  if (error || !request_) {
    return NextResponse.json({ error: 'Failed to submit leave request.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'leave_request',
    entity_id: request_.id,
    new_value: request_,
  });

  return NextResponse.json({ leave_request: request_ }, { status: 201 });
}
