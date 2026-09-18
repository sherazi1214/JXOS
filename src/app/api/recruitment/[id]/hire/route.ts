// ============================================================================
// POST /api/recruitment/:id/hire
//
// Implements the brief's Recruitment pipeline finish line (section 13):
// Application -> ... -> Offer -> Hired. Hiring a candidate creates their
// Employee Master record (base_salary from offered_salary, falling back to
// expected_salary) and marks the candidate 'hired' — mirroring the Lead ->
// Client convert flow in the CRM module, so the pipeline can never show
// "hired" without a real employee behind it.
//
// RBAC: requires both recruitment.update (to close out the candidate) and
// employees.create (to create the new employee record).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, RECRUITMENT_PERMISSIONS, EMPLOYEE_PERMISSIONS } from '@/lib/rbac';

function generateEmployeeCode(): string {
  return `JT-${Date.now().toString(36).toUpperCase()}`;
}

const hireSchema = z.object({
  joining_date: z.string().min(1, 'Joining date is required'),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  currency: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(RECRUITMENT_PERMISSIONS.UPDATE) || !permissions.includes(EMPLOYEE_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = hireSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'joining_date is required.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();
  const { data: candidate, error: candidateError } = await db
    .from('candidates')
    .select('*')
    .eq('id', resolvedParams.id)
    .single();

  if (candidateError || !candidate) {
    return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });
  }
  if (candidate.stage === 'hired') {
    return NextResponse.json({ error: 'This candidate has already been hired.' }, { status: 409 });
  }
  if (!candidate.email) {
    return NextResponse.json(
      { error: 'Candidate needs an email on file before they can be hired (employees require one).' },
      { status: 400 }
    );
  }

  const baseSalary = candidate.offered_salary ?? candidate.expected_salary ?? 0;

  const { data: employee, error: employeeError } = await db
    .from('employees')
    .insert({
      employee_code: generateEmployeeCode(),
      full_name: candidate.full_name,
      email: candidate.email,
      phone: candidate.phone,
      department_id: candidate.department_id,
      designation: candidate.position_title,
      joining_date: input.joining_date,
      employment_type: input.employment_type || 'full_time',
      base_salary: baseSalary,
      currency: input.currency || 'USD',
      status: 'active',
    })
    .select('*')
    .single();

  if (employeeError || !employee) {
    return NextResponse.json(
      {
        error:
          employeeError?.code === '23505'
            ? 'An employee with this email already exists.'
            : 'Failed to create employee record.',
      },
      { status: employeeError?.code === '23505' ? 409 : 500 }
    );
  }

  const { data: updatedCandidate } = await db
    .from('candidates')
    .update({
      stage: 'hired',
      joining_date: input.joining_date,
      offered_salary: baseSalary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidate.id)
    .select('*')
    .single();

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'hire',
    entity_type: 'candidate',
    entity_id: candidate.id,
    new_value: { employee_id: employee.id },
  });

  return NextResponse.json({ employee, candidate: updatedCandidate ?? candidate }, { status: 201 });
}
