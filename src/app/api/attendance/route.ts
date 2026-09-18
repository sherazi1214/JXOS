// ============================================================================
// GET   /api/attendance          — list attendance records (own, or all with attendance.view_all)
// POST  /api/attendance          — check in for today (or check out, if already checked in)
// PATCH /api/attendance          — manual correction of a record (attendance.update, e.g. HR)
//
// RBAC: attendance.view / attendance.view_all / attendance.check_in / attendance.update
// (see src/lib/rbac.ts). A user with only attendance.check_in can check
// themself in/out and see their own history; attendance.view_all is needed
// to list other employees' records or filter by employee_id.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, ATTENDANCE_PERMISSIONS } from '@/lib/rbac';

const ATTENDANCE_SELECT = `
  *,
  employee:employees(id, employee_code, full_name, department_id)
`;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Working hours = check_out - check_in, in decimal hours, rounded to 2dp. */
function computeWorkingHours(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, Math.round((ms / 1000 / 60 / 60) * 100) / 100);
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(ATTENDANCE_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAll = permissions.includes(ATTENDANCE_PERMISSIONS.VIEW_ALL);

  const { searchParams } = req.nextUrl;
  const employeeIdParam = searchParams.get('employee_id');
  const dateFrom = searchParams.get('from');
  const dateTo = searchParams.get('to');
  const status = searchParams.get('status');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 30));

  const db = supabaseServer();
  let query = db.from('attendance').select(ATTENDANCE_SELECT, { count: 'exact' });

  if (canViewAll) {
    // HR/CEO/Project Manager can filter by any employee, or see everyone.
    if (employeeIdParam) query = query.eq('employee_id', employeeIdParam);
  } else {
    // Everyone else only ever sees their own record, regardless of the
    // employee_id they pass in.
    if (!user.employee_id) {
      return NextResponse.json({ attendance: [], total: 0, page, pageSize });
    }
    query = query.eq('employee_id', user.employee_id);
  }

  if (dateFrom) query = query.gte('attendance_date', dateFrom);
  if (dateTo) query = query.lte('attendance_date', dateTo);
  if (status) query = query.eq('status', status);

  query = query.order('attendance_date', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load attendance.' }, { status: 500 });
  }

  return NextResponse.json({ attendance: data, total: count ?? 0, page, pageSize });
}

const checkInOutSchema = z.object({
  action: z.enum(['check_in', 'check_out']),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(ATTENDANCE_PERMISSIONS.CHECK_IN)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!user.employee_id) {
    return NextResponse.json(
      { error: 'This account is not linked to an employee record.' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = checkInOutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Pass { action: "check_in" | "check_out" }.' }, { status: 400 });
  }

  const db = supabaseServer();
  const today = todayDate();
  const now = new Date().toISOString();

  const { data: existing } = await db
    .from('attendance')
    .select('*')
    .eq('employee_id', user.employee_id)
    .eq('attendance_date', today)
    .maybeSingle();

  if (parsed.data.action === 'check_in') {
    if (existing?.check_in) {
      return NextResponse.json({ error: 'Already checked in today.' }, { status: 409 });
    }

    // Late if checking in after 9:15 AM local server time — adjust to taste.
    const lateThreshold = new Date();
    lateThreshold.setHours(9, 15, 0, 0);
    const lateMinutes =
      new Date(now) > lateThreshold
        ? Math.round((new Date(now).getTime() - lateThreshold.getTime()) / 60000)
        : 0;

    const { data: record, error } = await db
      .from('attendance')
      .upsert(
        {
          employee_id: user.employee_id,
          attendance_date: today,
          check_in: now,
          late_minutes: lateMinutes,
          status: lateMinutes > 0 ? 'late' : 'present',
        },
        { onConflict: 'employee_id,attendance_date' }
      )
      .select(ATTENDANCE_SELECT)
      .single();

    if (error || !record) {
      return NextResponse.json({ error: 'Failed to check in.' }, { status: 500 });
    }

    await db.from('audit_logs').insert({
      user_id: user.id,
      action: 'check_in',
      entity_type: 'attendance',
      entity_id: record.id,
      new_value: record,
    });

    return NextResponse.json({ attendance: record }, { status: 201 });
  }

  // action === 'check_out'
  if (!existing?.check_in) {
    return NextResponse.json({ error: 'You have not checked in today.' }, { status: 409 });
  }
  if (existing.check_out) {
    return NextResponse.json({ error: 'Already checked out today.' }, { status: 409 });
  }

  const workingHours = computeWorkingHours(existing.check_in, now);
  const overtimeHours = Math.max(0, Math.round((workingHours - 8) * 100) / 100);

  const { data: record, error } = await db
    .from('attendance')
    .update({
      check_out: now,
      working_hours: workingHours,
      overtime_hours: overtimeHours,
      updated_at: now,
    })
    .eq('id', existing.id)
    .select(ATTENDANCE_SELECT)
    .single();

  if (error || !record) {
    return NextResponse.json({ error: 'Failed to check out.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'check_out',
    entity_type: 'attendance',
    entity_id: record.id,
    new_value: record,
  });

  return NextResponse.json({ attendance: record });
}

const updateSchema = z.object({
  id: z.string().uuid(),
  check_in: z.string().optional().nullable(),
  check_out: z.string().optional().nullable(),
  status: z.enum(['present', 'absent', 'late', 'half_day', 'leave', 'holiday']).optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(ATTENDANCE_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid attendance data.' },
      { status: 400 }
    );
  }
  const { id, ...patch } = parsed.data;

  const db = supabaseServer();
  const { data: before } = await db.from('attendance').select('*').eq('id', id).single();
  if (!before) {
    return NextResponse.json({ error: 'Attendance record not found.' }, { status: 404 });
  }

  const finalCheckIn = patch.check_in ?? before.check_in;
  const finalCheckOut = patch.check_out ?? before.check_out;
  const workingHours =
    finalCheckIn && finalCheckOut ? computeWorkingHours(finalCheckIn, finalCheckOut) : before.working_hours;

  const { data: record, error } = await db
    .from('attendance')
    .update({ ...patch, working_hours: workingHours, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(ATTENDANCE_SELECT)
    .single();

  if (error || !record) {
    return NextResponse.json({ error: 'Failed to update attendance.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'attendance',
    entity_id: id,
    previous_value: before,
    new_value: record,
  });

  return NextResponse.json({ attendance: record });
}