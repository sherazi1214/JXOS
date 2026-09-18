// ============================================================================
// GET   /api/leave/:id  — fetch a single leave request
// PATCH /api/leave/:id  — approve / reject (leave.approve), or cancel your
//                         own still-pending request
//
// RBAC: leave.view (own record, unless leave.view_all) / leave.approve.
// Approving marks each calendar day in the range as 'leave' on the
// employee's attendance record (Module 9's "Attendance Automation" from the
// brief — leave feeds attendance, attendance feeds payroll) unless that day
// already has a check-in, which is left alone.
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

async function loadContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
  const db = supabaseServer();

  const { data: existing, error } = await db
    .from('leave_requests')
    .select(LEAVE_SELECT)
    .eq('id', id)
    .single();

  if (error || !existing) {
    return { error: NextResponse.json({ error: 'Leave request not found.' }, { status: 404 }) };
  }

  return { user, db, permissions, existing: existing as Record<string, any> };
}

/** Marks each day of [start, end] as 'leave' on attendance, skipping days that
 *  already have a check-in (someone worked part of the day). */
async function markAttendanceAsLeave(db: ReturnType<typeof supabaseServer>, employeeId: string, startDate: string, endDate: string) {
  const days: string[] = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const day of days) {
    const { data: existingAttendance } = await db
      .from('attendance')
      .select('id, check_in')
      .eq('employee_id', employeeId)
      .eq('attendance_date', day)
      .maybeSingle();

    if (existingAttendance?.check_in) continue; // already worked that day, leave it alone

    await db.from('attendance').upsert(
      { employee_id: employeeId, attendance_date: day, status: 'leave' },
      { onConflict: 'employee_id,attendance_date' }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, permissions, existing } = ctx;

  const isOwnRecord = user.employee_id === existing.employee_id;
  if (!permissions.includes(LEAVE_PERMISSIONS.VIEW_ALL) && !isOwnRecord) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ leave_request: existing });
}

const patchSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled']),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Pass { status: "approved" | "rejected" | "cancelled" }.' }, { status: 400 });
  }
  const nextStatus = parsed.data.status;

  const isOwner = user.employee_id === existing.employee_id;
  const canApprove = permissions.includes(LEAVE_PERMISSIONS.APPROVE);

  if (nextStatus === 'cancelled') {
    // Self-service: an employee can withdraw their own request while it's
    // still pending. An approver can also cancel a request on someone's
    // behalf (e.g. plans changed after it was already approved).
    if (!isOwner && !canApprove) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    if (isOwner && !canApprove && existing.status !== 'pending') {
      return NextResponse.json({ error: 'Only a pending request can be withdrawn.' }, { status: 409 });
    }
  } else if (!canApprove) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  if (existing.status !== 'pending') {
    return NextResponse.json({ error: `This request has already been ${existing.status}.` }, { status: 409 });
  }

  const { data: updated, error } = await db
    .from('leave_requests')
    .update({
      status: nextStatus,
      approved_by: nextStatus === 'approved' || nextStatus === 'rejected' ? user.id : existing.approved_by,
      approved_at: nextStatus === 'approved' || nextStatus === 'rejected' ? new Date().toISOString() : existing.approved_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', resolvedParams.id)
    .select(LEAVE_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update leave request.' }, { status: 500 });
  }

  if (nextStatus === 'approved') {
    await markAttendanceAsLeave(db, existing.employee_id, existing.start_date, existing.end_date);
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: nextStatus,
    entity_type: 'leave_request',
    entity_id: resolvedParams.id,
    previous_value: existing,
    new_value: updated,
  });

  return NextResponse.json({ leave_request: updated });
}
