// ============================================================================
// GET  /api/assets  — list company assets (filtered by type/status, searched
//                      by asset_code/serial_number), with the assigned
//                      employee joined in.
// POST /api/assets  — register a new asset.
//
// RBAC: assets.view / assets.create (Module 12 — Assets & IT).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, ASSET_PERMISSIONS } from '@/lib/rbac';

const ASSET_SELECT = `
  *,
  employee:assigned_to(id, full_name, employee_code)
`;

const createAssetSchema = z.object({
  asset_type: z.string().min(1, 'Asset type is required'),
  serial_number: z.string().optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  purchase_cost: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  condition: z.enum(['new', 'good', 'fair', 'poor']).optional(),
  warranty_until: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  status: z.enum(['available', 'assigned', 'in_repair', 'retired']).optional(),
});

function generateAssetCode(): string {
  return `AST-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(ASSET_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const assetType = searchParams.get('asset_type');
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const db = supabaseServer();
  let query = db.from('assets').select(ASSET_SELECT, { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (assetType) query = query.eq('asset_type', assetType);
  if (search) query = query.or(`asset_code.ilike.%${search}%,serial_number.ilike.%${search}%`);

  query = query.order('created_at', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load assets.' }, { status: 500 });
  }

  return NextResponse.json({ assets: data, total: count ?? 0, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(ASSET_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createAssetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid asset data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();
  const { data: asset, error } = await db
    .from('assets')
    .insert({
      asset_code: generateAssetCode(),
      asset_type: input.asset_type,
      serial_number: input.serial_number || null,
      purchase_date: input.purchase_date || null,
      purchase_cost: input.purchase_cost ?? null,
      currency: input.currency || 'USD',
      assigned_to: input.assigned_to || null,
      condition: input.condition || 'new',
      warranty_until: input.warranty_until || null,
      location: input.location || null,
      status: input.assigned_to ? 'assigned' : input.status || 'available',
    })
    .select(ASSET_SELECT)
    .single();

  if (error || !asset) {
    return NextResponse.json({ error: 'Failed to register asset.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'asset',
    entity_id: asset.id,
    new_value: asset,
  });

  return NextResponse.json({ asset }, { status: 201 });
}
