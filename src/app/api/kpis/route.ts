// ============================================================================
// GET  /api/kpis  — list Company Goals & KPIs (Module 13), filterable by
//                    period_type/period_start. achievement_pct is a
//                    generated column in Postgres (actual/target * 100).
// POST /api/kpis  — set a new target for a metric/period (upsert on the
//                    (period_type, period_start, metric) unique key so
//                    re-submitting the same period just updates it).
//
// RBAC: kpis.view / kpis.manage.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, KPI_PERMISSIONS } from '@/lib/rbac';

const createKpiSchema = z.object({
  period_type: z.enum(['monthly', 'quarterly', 'yearly']),
  period_start: z.string().min(1, 'Period start date is required'),
  metric: z.string().min(1, 'Metric name is required'),
  target_value: z.coerce.number(),
  actual_value: z.coerce.number().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(KPI_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const periodType = searchParams.get('period_type');
  const periodStart = searchParams.get('period_start');

  const db = supabaseServer();
  let query = db.from('company_kpis').select('*').order('period_start', { ascending: false });
  if (periodType) query = query.eq('period_type', periodType);
  if (periodStart) query = query.eq('period_start', periodStart);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load KPIs.' }, { status: 500 });
  }

  return NextResponse.json({ kpis: data });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(KPI_PERMISSIONS.MANAGE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createKpiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid KPI data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();
  const { data: kpi, error } = await db
    .from('company_kpis')
    .upsert(
      {
        period_type: input.period_type,
        period_start: input.period_start,
        metric: input.metric,
        target_value: input.target_value,
        actual_value: input.actual_value ?? 0,
      },
      { onConflict: 'period_type,period_start,metric' }
    )
    .select('*')
    .single();

  if (error || !kpi) {
    return NextResponse.json({ error: 'Failed to save KPI.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'upsert',
    entity_type: 'company_kpi',
    entity_id: kpi.id,
    new_value: kpi,
  });

  return NextResponse.json({ kpi }, { status: 201 });
}
