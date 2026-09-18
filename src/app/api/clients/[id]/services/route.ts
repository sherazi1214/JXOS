// ============================================================================
// GET  /api/clients/:id/services  — services linked to a client
// POST /api/clients/:id/services  — link a service to a client
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, CLIENT_PERMISSIONS } from '@/lib/rbac';

const linkServiceSchema = z.object({
  service_id: z.string().uuid('Pick a service.'),
  started_at: z.string().optional(),
});

async function checkClientAccess(clientId: string, requireUpdate: boolean) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
  const need = requireUpdate ? CLIENT_PERMISSIONS.UPDATE : CLIENT_PERMISSIONS.VIEW;
  if (!permissions.includes(need)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) };
  }
  const canViewAll = permissions.includes(CLIENT_PERMISSIONS.VIEW_ALL);

  const db = supabaseServer();
  const { data: client, error } = await db
    .from('clients')
    .select('id, account_manager_id')
    .eq('id', clientId)
    .is('deleted_at', null)
    .single();

  if (error || !client) {
    return { error: NextResponse.json({ error: 'Client not found.' }, { status: 404 }) };
  }

  const isOwner = client.account_manager_id && client.account_manager_id === user.employee_id;
  if (!canViewAll && !isOwner) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) };
  }

  return { db };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await checkClientAccess(resolvedParams.id, false);
  if ('error' in ctx) return ctx.error;
  const { db } = ctx;

  const { data, error } = await db
    .from('client_services')
    .select('*, service:services(id, name)')
    .eq('client_id', resolvedParams.id)
    .order('started_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to load services.' }, { status: 500 });
  }

  return NextResponse.json({ client_services: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await checkClientAccess(resolvedParams.id, true);
  if ('error' in ctx) return ctx.error;
  const { db } = ctx;

  const body = await req.json().catch(() => null);
  const parsed = linkServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const { data: clientService, error } = await db
    .from('client_services')
    .insert({
      client_id: resolvedParams.id,
      service_id: input.service_id,
      started_at: input.started_at || new Date().toISOString().slice(0, 10),
    })
    .select('*, service:services(id, name)')
    .single();

  if (error || !clientService) {
    return NextResponse.json(
      { error: error?.code === '23505' ? 'This service is already linked.' : 'Failed to link service.' },
      { status: error?.code === '23505' ? 409 : 500 }
    );
  }

  return NextResponse.json({ client_service: clientService }, { status: 201 });
}
