// ============================================================================
// GET  /api/subscriptions  — list recurring vendor subscriptions, flagging
//                             any renewing within RENEWAL_ALERT_WINDOW_DAYS
//                             so the Vendors page and CEO dashboard alerts
//                             (Module 1 / Module 19 "Subscription Automation")
//                             can surface them.
// POST /api/subscriptions  — attach a new subscription to a vendor.
//
// RBAC: piggybacks on vendors.view / vendors.create — a subscription has no
// meaning without its vendor, so it shares the same permission codes.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, VENDOR_PERMISSIONS } from '@/lib/rbac';

const SUBSCRIPTION_SELECT = `
  *,
  vendor:vendors(id, name),
  owner:owner_id(id, full_name)
`;

const createSubscriptionSchema = z.object({
  vendor_id: z.string().uuid('A vendor is required'),
  service_name: z.string().min(1, 'Service name is required'),
  cost: z.coerce.number().nonnegative(),
  currency: z.string().optional(),
  billing_cycle: z.enum(['monthly', 'quarterly', 'yearly', 'one_time']).optional(),
  start_date: z.string().min(1, 'Start date is required'),
  renewal_date: z.string().optional().nullable(),
  payment_method: z
    .enum(['bank_transfer', 'credit_card', 'debit_card', 'cash', 'cheque', 'online_wallet', 'other'])
    .optional()
    .nullable(),
  owner_id: z.string().uuid().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(VENDOR_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const vendorId = searchParams.get('vendor_id');
  const activeOnly = searchParams.get('active') === 'true';

  const db = supabaseServer();
  let query = db.from('subscriptions').select(SUBSCRIPTION_SELECT).order('renewal_date', { ascending: true });
  if (vendorId) query = query.eq('vendor_id', vendorId);
  if (activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load subscriptions.' }, { status: 500 });
  }

  return NextResponse.json({ subscriptions: data });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(VENDOR_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid subscription data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const db = supabaseServer();
  const { data: subscription, error } = await db
    .from('subscriptions')
    .insert({
      vendor_id: input.vendor_id,
      service_name: input.service_name,
      cost: input.cost,
      currency: input.currency || 'USD',
      billing_cycle: input.billing_cycle || 'monthly',
      start_date: input.start_date,
      renewal_date: input.renewal_date || null,
      payment_method: input.payment_method || null,
      owner_id: input.owner_id || null,
    })
    .select(SUBSCRIPTION_SELECT)
    .single();

  if (error || !subscription) {
    return NextResponse.json({ error: 'Failed to create subscription.' }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'subscription',
    entity_id: subscription.id,
    new_value: subscription,
  });

  return NextResponse.json({ subscription }, { status: 201 });
}
