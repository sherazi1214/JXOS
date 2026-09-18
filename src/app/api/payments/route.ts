// ============================================================================
// GET /api/payments — list all recorded payments across invoices, most
//                      recent first. Used by the Finance dashboard/reports;
//                      recording a payment itself happens on the invoice it
//                      belongs to (POST /api/invoices/:id/payments).
//
// RBAC: payments.view.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, PAYMENT_PERMISSIONS } from '@/lib/rbac';

const PAYMENT_SELECT = `
  *,
  client:clients(id, company_name, client_code),
  invoice:invoices(id, invoice_number)
`;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(PAYMENT_PERMISSIONS.VIEW)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const clientId = searchParams.get('client_id');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const db = supabaseServer();
  let query = db.from('payments').select(PAYMENT_SELECT, { count: 'exact' });

  if (clientId) query = query.eq('client_id', clientId);

  query = query.order('payment_date', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load payments.' }, { status: 500 });
  }

  return NextResponse.json({ payments: data, total: count ?? 0, page, pageSize });
}
