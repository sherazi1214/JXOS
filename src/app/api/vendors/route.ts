// ============================================================================
// GET  /api/vendors  — list vendors with their subscriptions nested, so the
//                       Vendors & Subscriptions page (Module 11) can render
//                       one row per vendor with renewal info inline.
// POST /api/vendors  — add a new vendor
//
// RBAC: vendors.view / vendors.create (see rbac.ts). Finance-owned data —
// no "own record" scoping, same shape as Expenses.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, VENDOR_PERMISSIONS } from '@/lib/rbac';

const VENDOR_SELECT = `
  *,
  subscriptions(id, service_name, cost, currency, billing_cycle, start_date, renewal_date, payment_method, owner_id, is_active)
`;

const createVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  contact_email: z.string().email().optional().nullable().or(z.literal('')),
  contact_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(VENDOR_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search')?.trim();

  const db = supabaseServer();
  let query = db.from('vendors').select(VENDOR_SELECT).order('name', { ascending: true });
  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load vendors.' }, { status: 500 });
  }

  return NextResponse.json({ vendors: data });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(VENDOR_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createVendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid vendor data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();
  const { data: vendor, error } = await db
    .from('vendors')
    .insert({
      name: input.name,
      contact_email: input.contact_email || null,
      contact_phone: input.contact_phone || null,
      notes: input.notes || null,
    })
    .select(VENDOR_SELECT)
    .single();

  if (error || !vendor) {
    return NextResponse.json({ error: 'Failed to create vendor.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'vendor',
    entity_id: vendor.id,
    new_value: vendor,
  });

  return NextResponse.json({ vendor }, { status: 201 });
}
