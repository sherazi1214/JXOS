// ============================================================================
// GET  /api/services  — service catalog (Website Development, SEO, ...)
// POST /api/services  — add a new service to the catalog
//
// The catalog is shared infrastructure used by Clients, Contracts, and
// (later) Projects. Any authenticated user can read it; only clients.update
// holders can add to it for now, since Clients is the first module that
// curates it.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, CLIENT_PERMISSIONS } from '@/lib/rbac';

const createServiceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  description: z.string().optional().nullable(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const db = supabaseServer();
  const { data, error } = await db
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to load services.' }, { status: 500 });
  }

  return NextResponse.json({ services: data });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(CLIENT_PERMISSIONS.UPDATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid service data.' },
      { status: 400 }
    );
  }

  const db = supabaseServer();
  const { data: service, error } = await db
    .from('services')
    .insert({ name: parsed.data.name, description: parsed.data.description || null })
    .select('*')
    .single();

  if (error || !service) {
    return NextResponse.json(
      { error: error?.code === '23505' ? 'A service with this name already exists.' : 'Failed to create service.' },
      { status: error?.code === '23505' ? 409 : 500 }
    );
  }

  return NextResponse.json({ service }, { status: 201 });
}
