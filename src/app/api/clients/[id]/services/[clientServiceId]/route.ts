// ============================================================================
// DELETE /api/clients/:id/services/:clientServiceId — unlink a service
//
// Soft removal: sets ended_at rather than deleting the row, so the client's
// service history stays intact for reporting.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, CLIENT_PERMISSIONS } from '@/lib/rbac';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clientServiceId: string }> }
) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(CLIENT_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAll = permissions.includes(CLIENT_PERMISSIONS.VIEW_ALL);

  const db = supabaseServer();
  const { data: client } = await db
    .from('clients')
    .select('id, account_manager_id')
    .eq('id', resolvedParams.id)
    .is('deleted_at', null)
    .single();

  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  const isOwner = client.account_manager_id && client.account_manager_id === user.employee_id;
  if (!canViewAll && !isOwner) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { error } = await db
    .from('client_services')
    .update({ ended_at: new Date().toISOString().slice(0, 10) })
    .eq('id', resolvedParams.clientServiceId)
    .eq('client_id', resolvedParams.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to unlink service.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
