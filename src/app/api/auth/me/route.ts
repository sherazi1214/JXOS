// ============================================================================
// GET /api/auth/me
//
// Returns the authenticated user's public profile plus the full list of
// permission codes for their role, in a single call. Client components use
// this (via useAuth()) to decide what to render — e.g. hide the "Assign"
// field from a Salesperson — as a UX convenience only. The real enforcement
// always happens server-side in each API route via rbac.ts.
// ============================================================================

import { NextResponse } from 'next/server';
import { getCurrentUserWithRole } from '@/lib/auth';
import { getPermissionsForRole } from '@/lib/rbac';

export async function GET() {
  const user = await getCurrentUserWithRole();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const permissions = await getPermissionsForRole(user.role_id);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      role: user.roleName,
      role_id: user.role_id,
      employee_id: user.employee_id,
    },
    permissions,
  });
}
