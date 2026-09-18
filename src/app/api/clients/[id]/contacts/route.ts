// ============================================================================
// GET  /api/clients/:id/contacts  — list a client's contacts
// POST /api/clients/:id/contacts  — add a contact
//
// Gated by clients.update (contacts are part of editing a client), scoped
// by the same ownership rule as the client itself.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, CLIENT_PERMISSIONS } from '@/lib/rbac';

const createContactSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  title: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  is_primary: z.boolean().optional(),
});

async function checkClientAccess(clientId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };

  const permissions = await getPermissionsForRole(user.role_id);
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
  return { user, db, permissions, canViewAll, isOwner };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await checkClientAccess(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { db, permissions, canViewAll, isOwner } = ctx;

  if (!permissions.includes(CLIENT_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { data, error } = await db
    .from('client_contacts')
    .select('*')
    .eq('client_id', resolvedParams.id)
    .order('is_primary', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to load contacts.' }, { status: 500 });
  }

  return NextResponse.json({ contacts: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await checkClientAccess(resolvedParams.id);
  if ('error' in ctx) return ctx.error;
  const { db, permissions, canViewAll, isOwner } = ctx;

  if (!permissions.includes(CLIENT_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!canViewAll && !isOwner) {
    return NextResponse.json({ error: 'You can only edit clients you manage.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid contact data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (input.is_primary) {
    // Only one primary contact per client — demote any existing one.
    await db.from('client_contacts').update({ is_primary: false }).eq('client_id', resolvedParams.id);
  }

  const { data: contact, error } = await db
    .from('client_contacts')
    .insert({
      client_id: resolvedParams.id,
      full_name: input.full_name,
      title: input.title || null,
      email: input.email || null,
      phone: input.phone || null,
      is_primary: input.is_primary ?? false,
    })
    .select('*')
    .single();

  if (error || !contact) {
    return NextResponse.json({ error: 'Failed to add contact.' }, { status: 500 });
  }

  return NextResponse.json({ contact }, { status: 201 });
}
