// ============================================================================
// GET   /api/payroll/:id  — fetch a single payroll record
// PATCH /api/payroll/:id  — while status='draft': adjust bonus/commission/
//                           overtime/deductions (payroll.generate); or move
//                           status draft -> approved -> locked (payroll.approve).
//                           A locked record can never be edited again — the
//                           brief's "monthly payroll records should be
//                           generated and locked after approval".
//
// RBAC: payroll.view (own record, unless payroll.view_all) / payroll.generate
// / payroll.approve.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, PAYROLL_PERMISSIONS } from '@/lib/rbac';

const PAYROLL_SELECT = `
  *,
  employee:employees(id, employee_code, full_name, department_id, base_salary, currency),
  approver:approved_by(id, full_name)
`;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['approved'],
  approved: ['locked'],
  locked: [],
};

async function loadContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
  const db = supabaseServer();

  const { data: existing, error } = await db.from('payroll').select(PAYROLL_SELECT).eq('id', id).single();
  if (error || !existing) {
    return { error: NextResponse.json({ error: 'Payroll record not found.' }, { status: 404 }) };
  }

  return { user, db, permissions, existing: existing as Record<string, any> };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, permissions, existing } = ctx;

  const isOwnRecord = user.employee_id === existing.employee_id;
  if (!permissions.includes(PAYROLL_PERMISSIONS.VIEW_ALL) && !isOwnRecord) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ payroll: existing });
}

const patchSchema = z.object({
  status: z.enum(['approved', 'locked']).optional(),
  bonus_total: z.coerce.number().nonnegative().optional(),
  commission_total: z.coerce.number().nonnegative().optional(),
  overtime_pay: z.coerce.number().nonnegative().optional(),
  deductions: z.coerce.number().nonnegative().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payroll update.' },
      { status: 400 }
    );
  }
  const { status: nextStatus, ...fieldEdits } = parsed.data;

  if (existing.status === 'locked') {
    return NextResponse.json({ error: 'This payroll record is locked and can no longer be edited.' }, { status: 409 });
  }

  const hasFieldEdits = Object.keys(fieldEdits).length > 0;
  if (hasFieldEdits) {
    if (!permissions.includes(PAYROLL_PERMISSIONS.GENERATE)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Only a draft record can be adjusted.' }, { status: 409 });
    }
  }

  if (nextStatus) {
    if (!permissions.includes(PAYROLL_PERMISSIONS.APPROVE)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    if (!ALLOWED_TRANSITIONS[existing.status]?.includes(nextStatus)) {
      return NextResponse.json(
        { error: `Cannot move a ${existing.status} record to ${nextStatus}.` },
        { status: 409 }
      );
    }
  }

  const patch: Record<string, any> = { ...fieldEdits, updated_at: new Date().toISOString() };
  if (nextStatus === 'approved') {
    patch.status = 'approved';
    patch.approved_by = user.id;
    patch.approved_at = new Date().toISOString();
  } else if (nextStatus === 'locked') {
    patch.status = 'locked';
  }

  const { data: updated, error } = await db
    .from('payroll')
    .update(patch)
    .eq('id', resolvedParams.id)
    .select(PAYROLL_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update payroll record.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: nextStatus ?? 'update',
    entity_type: 'payroll',
    entity_id: resolvedParams.id,
    previous_value: existing,
    new_value: updated,
  });

  return NextResponse.json({ payroll: updated });
}
