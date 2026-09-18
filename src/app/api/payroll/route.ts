// ============================================================================
// GET  /api/payroll   — list payroll records (own, or all with payroll.view_all)
// POST /api/payroll   — generate a draft payroll run for a period_month
//
// RBAC: payroll.view / payroll.view_all / payroll.generate (see rbac.ts).
//
// Generation logic (brief Module 10): for every active employee, pull
//   - base_salary straight off the employee record
//   - commission_total  = sum(commissions) for that employee + period
//   - bonus_total       = sum(bonuses) for that employee + period
//   - overtime_pay      = sum(attendance.overtime_hours) for the month, at
//                          a flat hourly rate derived from base_salary
//                          (base_salary / 22 working days / 8 hours)
// and upsert into `payroll`. Re-running for the same period recalculates
// only rows still in 'draft' — approved/locked rows are left untouched, so
// generating twice is safe.
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

function monthBounds(periodMonth: string): { start: string; end: string } {
  const parts = periodMonth.split('-').map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? 1;
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(year, month, 0).toISOString().slice(0, 10); // last day of month
  return { start, end };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(PAYROLL_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAll = permissions.includes(PAYROLL_PERMISSIONS.VIEW_ALL);

  const { searchParams } = req.nextUrl;
  const employeeIdParam = searchParams.get('employee_id');
  const periodMonth = searchParams.get('period_month');
  const status = searchParams.get('status');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const db = supabaseServer();
  let query = db.from('payroll').select(PAYROLL_SELECT, { count: 'exact' });

  if (canViewAll) {
    if (employeeIdParam) query = query.eq('employee_id', employeeIdParam);
  } else {
    if (!user.employee_id) {
      return NextResponse.json({ payroll: [], total: 0, page, pageSize });
    }
    query = query.eq('employee_id', user.employee_id);
  }

  if (periodMonth) query = query.eq('period_month', periodMonth);
  if (status) query = query.eq('status', status);
  query = query.order('period_month', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load payroll.' }, { status: 500 });
  }

  return NextResponse.json({ payroll: data, total: count ?? 0, page, pageSize });
}

const generateSchema = z.object({
  period_month: z.string().regex(/^\d{4}-\d{2}-01$/, 'period_month must be a first-of-month date, e.g. 2026-09-01'),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(PAYROLL_PERMISSIONS.GENERATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
      { status: 400 }
    );
  }
  const { period_month } = parsed.data;
  const { start, end } = monthBounds(period_month);

  const db = supabaseServer();

  const { data: employees, error: empError } = await db
    .from('employees')
    .select('id, base_salary, currency')
    .eq('status', 'active')
    .is('deleted_at', null);

  if (empError || !employees) {
    return NextResponse.json({ error: 'Failed to load employees.' }, { status: 500 });
  }

  const results: any[] = [];

  for (const employee of employees) {
    // Skip employees whose row for this period is already approved/locked —
    // regenerating must never silently overwrite a signed-off payslip.
    const { data: existingRow } = await db
      .from('payroll')
      .select('id, status')
      .eq('employee_id', employee.id)
      .eq('period_month', period_month)
      .maybeSingle();

    if (existingRow && existingRow.status !== 'draft') {
      results.push(existingRow);
      continue;
    }

    const [{ data: commissions }, { data: bonuses }, { data: attendanceRows }] = await Promise.all([
      db.from('commissions').select('amount').eq('employee_id', employee.id).eq('period_month', period_month),
      db.from('bonuses').select('amount').eq('employee_id', employee.id).eq('period_month', period_month),
      db
        .from('attendance')
        .select('overtime_hours')
        .eq('employee_id', employee.id)
        .gte('attendance_date', start)
        .lte('attendance_date', end),
    ]);

    const commissionTotal = (commissions ?? []).reduce((sum, c) => sum + Number(c.amount), 0);
    const bonusTotal = (bonuses ?? []).reduce((sum, b) => sum + Number(b.amount), 0);
    const overtimeHours = (attendanceRows ?? []).reduce((sum, a) => sum + Number(a.overtime_hours ?? 0), 0);
    const hourlyRate = Number(employee.base_salary) / 22 / 8;
    const overtimePay = Math.round(overtimeHours * hourlyRate * 100) / 100;

    const upsertRow: Record<string, unknown> = {
      employee_id: employee.id,
      period_month,
      base_salary: employee.base_salary,
      commission_total: commissionTotal,
      bonus_total: bonusTotal,
      overtime_pay: overtimePay,
      status: 'draft',
    };
    if (!existingRow) upsertRow.deductions = 0;

    const { data: row, error: upsertError } = await db
      .from('payroll')
      .upsert(upsertRow, { onConflict: 'employee_id,period_month' })
      .select(PAYROLL_SELECT)
      .single();

    if (!upsertError && row) results.push(row);
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'generate',
    entity_type: 'payroll',
    entity_id: null,
    new_value: { period_month, rows_generated: results.length },
  });

  return NextResponse.json({ payroll: results, period_month }, { status: 201 });
}
