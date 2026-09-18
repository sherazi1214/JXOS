// ============================================================================
// GET  /api/invoices  — list invoices (filtered by client/status, searched
//                        by invoice number, paginated). Each row includes
//                        payments so the UI can compute the outstanding
//                        balance (total_amount − sum(payments)) without an
//                        extra round trip.
// POST /api/invoices  — create an invoice with one or more line items
//
// RBAC: invoices.view / invoices.view_all / invoices.create. Unlike
// leads/clients there's no "own record" scoping here — invoices are
// Finance-owned data (see rbac.ts), so invoices.view_all is required to use
// this endpoint at all.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, INVOICE_PERMISSIONS } from '@/lib/rbac';

const INVOICE_SELECT = `
  *,
  client:clients(id, company_name, client_code),
  contract:contracts(id, contract_code),
  payments(id, amount)
`;

const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity: z.number().positive().default(1),
  unit_price: z.number().nonnegative(),
});

const createInvoiceSchema = z.object({
  client_id: z.string().uuid('A client is required'),
  contract_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  invoice_date: z.string().optional(),
  due_date: z.string().min(1, 'Due date is required'),
  tax_amount: z.number().nonnegative().optional(),
  discount_amount: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  status: z.enum(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled']).optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item is required'),
});

function generateInvoiceNumber(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(INVOICE_PERMISSIONS.VIEW) || !permissions.includes(INVOICE_PERMISSIONS.VIEW_ALL)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const clientId = searchParams.get('client_id');
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const db = supabaseServer();
  let query = db.from('invoices').select(INVOICE_SELECT, { count: 'exact' }).is('deleted_at', null);

  if (status) query = query.eq('status', status);
  if (clientId) query = query.eq('client_id', clientId);
  if (search) query = query.ilike('invoice_number', `%${search}%`);

  query = query.order('invoice_date', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to load invoices.' }, { status: 500 });
  }

  return NextResponse.json({ invoices: data, total: count ?? 0, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(INVOICE_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid invoice data.' },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const invoiceDate = input.invoice_date || new Date().toISOString().slice(0, 10);
  if (input.due_date < invoiceDate) {
    return NextResponse.json({ error: 'Due date cannot be before the invoice date.' }, { status: 400 });
  }

  const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const db = supabaseServer();
  const { data: invoice, error } = await db
    .from('invoices')
    .insert({
      invoice_number: generateInvoiceNumber(),
      client_id: input.client_id,
      contract_id: input.contract_id || null,
      project_id: input.project_id || null,
      invoice_date: invoiceDate,
      due_date: input.due_date,
      subtotal,
      tax_amount: input.tax_amount ?? 0,
      discount_amount: input.discount_amount ?? 0,
      currency: input.currency || 'USD',
      status: input.status || 'draft',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: 'Failed to create invoice.' }, { status: 500 });
  }

  const { error: itemsError } = await db.from('invoice_items').insert(
    input.items.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))
  );

  if (itemsError) {
    // Roll back the orphaned invoice header rather than leaving a
    // line-item-less invoice behind.
    await db.from('invoices').delete().eq('id', invoice.id);
    return NextResponse.json({ error: 'Failed to save invoice line items.' }, { status: 500 });
  }

  const { data: full } = await db
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('id', invoice.id)
    .single();

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'create',
    entity_type: 'invoice',
    entity_id: invoice.id,
    new_value: full,
  });

  return NextResponse.json({ invoice: full }, { status: 201 });
}
