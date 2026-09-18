// ============================================================================
// PATCH  /api/clients/:id/contacts/:contactId  — edit a contact
// DELETE /api/clients/:id/contacts/:contactId  — remove a contact
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, CLIENT_PERMISSIONS } from '@/lib/rbac';

const updateContactSchema = z.object({
  full_name: z.string().min(1).optional(),
  title: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  is_primary: z.boolean().optional(),
});

async function checkAccess(clientId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(CLIENT_PERMISSIONS.UPDATE)) {
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
    return { error: NextResponse.json({ error: 'You can only edit clients you manage.' }, { status: 403 }) };
  }

  return { db };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const resolvedParams = await params;
  const ctx = await checkAccess(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { db } = ctx;

  const body = await req.json().catch(() => null);
  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid contact data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (input.is_primary) {
    await db
      .from('client_contacts')
      .update({ is_primary: false })
      .eq('client_id', resolvedParams.id)
      .neq('id', resolvedParams.contactId);
  }

  const { data: contact, error } = await db
    .from('client_contacts')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', resolvedParams.contactId)
    .eq('client_id', resolvedParams.id)
    .select('*')
    .single();

  if (error || !contact) {
    return NextResponse.json({ error: 'Failed to update contact.' }, { status: 500 });
  }

  return NextResponse.json({ contact });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const resolvedParams = await params;
  const ctx = await checkAccess(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { db } = ctx;

  const { error } = await db
    .from('client_contacts')
    .delete()
    .eq('id', resolvedParams.contactId)
    .eq('client_id', resolvedParams.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to remove contact.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
