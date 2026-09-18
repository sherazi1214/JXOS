// ============================================================================
// GET  /api/recruitment  — list candidates (filtered by stage/department,
//                          searched by name/email, paginated)
// POST /api/recruitment  — add a new candidate application
//
// RBAC: recruitment.view / recruitment.create (see rbac.ts). HR-owned data,
// no per-record scoping — same shape as /api/employees but without a
// view_all split, since candidates aren't "owned" by anyone until hired.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, RECRUITMENT_PERMISSIONS } from '@/lib/rbac';

const CANDIDATE_SELECT = `*, department:departments(id, name)`;

const createCandidateSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  position_title: z.string().min(1, 'Position title is required'),
  department_id: z.string().uuid().optional().nullable(),
  source: z.string().optional().nullable(),
  application_date: z.string().optional(),
  expected_salary: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(RECRUITMENT_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const stage = searchParams.get('stage');
  const departmentId = searchParams.get('department_id');
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const db = supabaseServer();
  let query = db.from('candidates').select(CANDIDATE_SELECT, { count: 'exact' });

  if (stage) query = query.eq('stage', stage);
  if (departmentId) query = query.eq('department_id', departmentId);
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,position_title.ilike.%${search}%`);
  }

  query = query.order('application_date', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load candidates.' }, { status: 500 });
  }

  return NextResponse.json({ candidates: data, total: count ?? 0, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(RECRUITMENT_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid candidate data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();
  const { data: candidate, error } = await db
    .from('candidates')
    .insert({
      full_name: input.full_name,
      email: input.email || null,
      phone: input.phone || null,
      position_title: input.position_title,
      department_id: input.department_id || null,
      source: input.source || null,
      application_date: input.application_date || new Date().toISOString().slice(0, 10),
      expected_salary: input.expected_salary ?? null,
      notes: input.notes || null,
      stage: 'application',
    })
    .select(CANDIDATE_SELECT)
    .single();

  if (error || !candidate) {
    return NextResponse.json({ error: 'Failed to add candidate.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'candidate',
    entity_id: candidate.id,
    new_value: candidate,
  });

  return NextResponse.json({ candidate }, { status: 201 });
}
