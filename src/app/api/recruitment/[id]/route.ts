// ============================================================================
// GET    /api/recruitment/:id  — fetch a single candidate
// PATCH  /api/recruitment/:id  — edit a candidate / move them through stages
// DELETE /api/recruitment/:id  — remove a candidate application
//
// RBAC: recruitment.view / recruitment.update / recruitment.delete.
// Moving a candidate's stage to 'hired' directly is blocked here — use
// POST /api/recruitment/:id/hire, which also creates the Employee record,
// so the pipeline can never show someone as "hired" without a matching
// employee (mirrors /api/leads/:id/convert).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, RECRUITMENT_PERMISSIONS } from '@/lib/rbac';

const CANDIDATE_SELECT = `*, department:departments(id, name)`;

const updateCandidateSchema = z.object({
  full_name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  position_title: z.string().min(1).optional(),
  department_id: z.string().uuid().optional().nullable(),
  source: z.string().optional().nullable(),
  stage: z
    .enum(['application', 'screening', 'interview', 'technical', 'final', 'offer', 'rejected'])
    .optional(),
  interview_score: z.coerce.number().min(0).max(10).optional().nullable(),
  expected_salary: z.coerce.number().nonnegative().optional().nullable(),
  offered_salary: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function loadContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(RECRUITMENT_PERMISSIONS.VIEW)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) };
  }

  const db = supabaseServer();
  const { data: existing, error } = await db.from('candidates').select(CANDIDATE_SELECT).eq('id', id).single();
  if (error || !existing) {
    return { error: NextResponse.json({ error: 'Candidate not found.' }, { status: 404 }) };
  }

  return { user, db, permissions, existing: existing as Record<string, any> };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  return NextResponse.json({ candidate: ctx.existing });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  if (!permissions.includes(RECRUITMENT_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (existing.stage === 'hired') {
    return NextResponse.json({ error: 'This candidate has already been hired.' }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid candidate data.' },
      { status: 400 }
    );
  }

  const { data: updated, error } = await db
    .from('candidates')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', resolvedParams.id)
    .select(CANDIDATE_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update candidate.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'update',
    entity_type: 'candidate',
    entity_id: resolvedParams.id,
    previous_value: existing,
    new_value: updated,
  });

  return NextResponse.json({ candidate: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await loadContext(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { user, db, permissions, existing } = ctx;

  if (!permissions.includes(RECRUITMENT_PERMISSIONS.DELETE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { error } = await db.from('candidates').delete().eq('id', resolvedParams.id);
  if (error) {
    return NextResponse.json({ error: 'Failed to remove candidate.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'delete',
    entity_type: 'candidate',
    entity_id: resolvedParams.id,
    previous_value: existing,
  });

  return NextResponse.json({ success: true });
}
