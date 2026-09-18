// ============================================================================
// POST /api/leads/:id/convert
//
// Implements the brief's "Lead → Client" automation (section 8 / 19):
// when a lead is won, automatically create the Client profile, its primary
// Contact (from the lead's contact info), a Service link (if the lead's
// "service interested in" matches the catalog), and a draft Contract
// seeded from the lead's value — instead of the CEO asking "who's
// following up with this lead" once it's actually a paying client.
//
// Project + invoice-schedule creation are left for the Projects/Finance
// modules to pick up once they exist; this hands off a fully-formed client
// + draft contract for them to build on.
//
// RBAC: requires both leads.update (to mark the lead won) and
// clients.create + clients.assign (creating a client and setting its
// account manager). A Salesperson without clients.assign can still convert
// their own lead — they just can't hand the resulting client to someone
// else; the account manager defaults to the lead's assignee either way.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/db';
import { getPermissionsForRole, LEAD_PERMISSIONS, CLIENT_PERMISSIONS } from '@/lib/rbac';

function generateClientCode(): string {
  return `CL-${Date.now().toString(36).toUpperCase()}`;
}
function generateContractCode(): string {
  return `CT-${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const permissions = await getPermissionsForRole(user.role_id);
  if (!permissions.includes(LEAD_PERMISSIONS.UPDATE) || !permissions.includes(CLIENT_PERMISSIONS.CREATE)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const canViewAllLeads = permissions.includes(LEAD_PERMISSIONS.VIEW_ALL);

  const db = supabaseServer();
  const { data: lead, error: leadError } = await db
    .from('leads')
    .select('*')
    .eq('id', resolvedParams.id)
    .is('deleted_at', null)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  }

  const isOwner = lead.assigned_to && lead.assigned_to === user.employee_id;
  if (!canViewAllLeads && !isOwner) {
    return NextResponse.json(
      { error: 'You can only convert leads assigned to you.' },
      { status: 403 }
    );
  }

  const { data: existingClient } = await db
    .from('clients')
    .select('id')
    .eq('source_lead_id', lead.id)
    .maybeSingle();

  if (existingClient) {
    return NextResponse.json(
      { error: 'This lead has already been converted to a client.', client_id: existingClient.id },
      { status: 409 }
    );
  }

  const accountManagerId = lead.assigned_to ?? user.employee_id ?? null;

  // 1. Client profile
  const { data: client, error: clientError } = await db
    .from('clients')
    .insert({
      client_code: generateClientCode(),
      company_name: lead.company_name,
      country: lead.country,
      industry: lead.industry,
      account_manager_id: accountManagerId,
      source_lead_id: lead.id,
      status: 'active',
      notes: lead.notes,
    })
    .select('*, account_manager:employees(id, full_name, employee_code)')
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: 'Failed to create client.' }, { status: 500 });
  }

  // 2. Primary contact, carried over from the lead if we have one
  if (lead.contact_person || lead.email || lead.phone) {
    await db.from('client_contacts').insert({
      client_id: client.id,
      full_name: lead.contact_person || lead.company_name,
      email: lead.email,
      phone: lead.phone,
      is_primary: true,
    });
  }

  // 3. Service link, if the lead's "service interested in" matches the catalog
  let matchedServiceId: string | null = null;
  if (lead.service_interested) {
    const { data: matchedService } = await db
      .from('services')
      .select('id')
      .ilike('name', lead.service_interested)
      .maybeSingle();
    if (matchedService) {
      matchedServiceId = matchedService.id;
      await db.from('client_services').insert({
        client_id: client.id,
        service_id: matchedService.id,
      });
    }
  }

  // 4. Draft contract seeded from the lead's value, ready for Finance/Ops
  //    to review and activate.
  const { data: contract } = await db
    .from('contracts')
    .insert({
      contract_code: generateContractCode(),
      client_id: client.id,
      service_id: matchedServiceId,
      start_date: new Date().toISOString().slice(0, 10),
      contract_value: lead.lead_value ?? 0,
      currency: lead.currency || 'USD',
      assigned_team_lead_id: accountManagerId,
      status: 'draft',
    })
    .select('id, contract_code, status')
    .single();

  // 5. Close the loop on the lead itself
  await db
    .from('leads')
    .update({ stage: 'won', updated_at: new Date().toISOString() })
    .eq('id', lead.id);

  await db.from('lead_activities').insert({
    lead_id: lead.id,
    activity_type: 'status_change',
    performed_by: user.employee_id,
    summary: `Converted to client ${client.client_code}${contract ? ` with draft contract ${contract.contract_code}` : ''}.`,
  });

  await db.from('audit_logs').insert({
    user_id: user.id,
    action: 'convert',
    entity_type: 'lead',
    entity_id: lead.id,
    new_value: { client_id: client.id, contract_id: contract?.id ?? null },
  });

  return NextResponse.json({ client, contract: contract ?? null }, { status: 201 });
}
