// ============================================================================
// RBAC — role-based permission checks.
//
// Permissions are enforced here on the SERVER (API routes / Server Actions),
// never just by hiding a button in the UI. `role_permissions` in the DB is
// the source of truth; this module reads it and gives call sites a simple
// hasPermission() / requirePermission() API.
// ============================================================================

import { supabaseServer } from '@/lib/db';

/** Built-in role names — must match the `roles` seed data in db/schema.sql */
export const ROLES = {
  CEO_ADMIN: 'CEO/Admin',
  HR: 'HR',
  FINANCE: 'Finance',
  SALES_MANAGER: 'Sales Manager',
  SALESPERSON: 'Salesperson',
  PROJECT_MANAGER: 'Project Manager',
  EMPLOYEE: 'Employee',
} as const;

/**
 * Permission codes used by the CRM/Leads module. Seeded into `permissions`
 * and `role_permissions` by db/migrations/0001_seed_crm_leads_permissions.sql.
 *
 *  - leads.view       — see leads assigned to you
 *  - leads.view_all   — see every lead in the company, not just your own
 *  - leads.create     — create new leads
 *  - leads.update     — edit lead fields / log activities (own leads unless leads.view_all)
 *  - leads.delete     — soft-delete a lead
 *  - leads.assign     — assign/reassign a lead to a salesperson
 */
export const LEAD_PERMISSIONS = {
  VIEW: 'leads.view',
  VIEW_ALL: 'leads.view_all',
  CREATE: 'leads.create',
  UPDATE: 'leads.update',
  DELETE: 'leads.delete',
  ASSIGN: 'leads.assign',
} as const;

/**
 * Permission codes for Opportunities (the CRM pipeline stage that follows a
 * qualified Lead). Same view/view_all/create/update/delete shape as leads,
 * seeded by the same migration. There's no separate "assign" permission —
 * ownership transfer piggybacks on leads.assign, since an opportunity's
 * owner is set from its parent lead's assignee.
 */
export const OPPORTUNITY_PERMISSIONS = {
  VIEW: 'opportunities.view',
  VIEW_ALL: 'opportunities.view_all',
  CREATE: 'opportunities.create',
  UPDATE: 'opportunities.update',
  DELETE: 'opportunities.delete',
} as const;

/**
 * Permission codes for the Clients module. Same view/view_all shape,
 * scoped by `clients.account_manager_id` instead of an assignee field.
 * clients.assign controls reassigning the account manager, and also gates
 * converting a Lead into a Client (POST /api/leads/:id/convert) since that
 * action effectively assigns the new client's account manager.
 */
export const CLIENT_PERMISSIONS = {
  VIEW: 'clients.view',
  VIEW_ALL: 'clients.view_all',
  CREATE: 'clients.create',
  UPDATE: 'clients.update',
  DELETE: 'clients.delete',
  ASSIGN: 'clients.assign',
} as const;

/**
 * Permission codes for Contracts (Module 4 — Services & Contracts).
 * Scoped by the contract's client: a Salesperson can only see/manage
 * contracts for clients they're the account manager for, unless they hold
 * contracts.view_all. Seeded by 0004_seed_finance_permissions.sql.
 */
export const CONTRACT_PERMISSIONS = {
  VIEW: 'contracts.view',
  VIEW_ALL: 'contracts.view_all',
  CREATE: 'contracts.create',
  UPDATE: 'contracts.update',
  DELETE: 'contracts.delete',
} as const;

/**
 * Permission codes for Invoices (Module 7 — Invoicing & Payments).
 * This is Finance-owned data: unlike leads/clients there's no "own record"
 * scoping — invoices.view_all is required to see the module at all, since
 * partial financial visibility (e.g. "your own invoices") isn't a
 * meaningful concept for anyone except the client-facing account manager,
 * who instead sees invoices nested under their own Client record.
 */
export const INVOICE_PERMISSIONS = {
  VIEW: 'invoices.view',
  VIEW_ALL: 'invoices.view_all',
  CREATE: 'invoices.create',
  UPDATE: 'invoices.update',
  DELETE: 'invoices.delete',
} as const;

/** Recording/voiding payments against invoices. */
export const PAYMENT_PERMISSIONS = {
  VIEW: 'payments.view',
  CREATE: 'payments.create',
  DELETE: 'payments.delete',
} as const;

/** Company expenses. */
export const EXPENSE_PERMISSIONS = {
  VIEW: 'expenses.view',
  CREATE: 'expenses.create',
  UPDATE: 'expenses.update',
  DELETE: 'expenses.delete',
} as const;

/**
 * Permission codes for the Employee Master (Module 8 — HR & Recruitment).
 * Scoped by employee: an Employee can see their own record with
 * employees.view alone; HR/CEO/Project Manager get employees.view_all for
 * the full roster. Create/update/delete stay with HR/CEO. Seeded by
 * 0007_seed_employees_and_departments.sql.
 */
export const EMPLOYEE_PERMISSIONS = {
  VIEW: 'employees.view',
  VIEW_ALL: 'employees.view_all',
  CREATE: 'employees.create',
  UPDATE: 'employees.update',
  DELETE: 'employees.delete',
} as const;

/**
 * Permission codes for Attendance (Module 9 — Attendance & Leave).
 * Scoped by employee: an Employee can check themself in/out and see their
 * own record (attendance.view + attendance.check_in on their own
 * employee_id) without attendance.view_all. HR/CEO get the full roster;
 * attendance.update covers manual corrections (e.g. HR fixing a missed
 * check-out). Seeded by 0005_seed_hr_permissions.sql.
 */
export const ATTENDANCE_PERMISSIONS = {
  VIEW: 'attendance.view',
  VIEW_ALL: 'attendance.view_all',
  CHECK_IN: 'attendance.check_in',
  UPDATE: 'attendance.update',
} as const;

/**
 * Permission codes for Leave Requests. Same own-record shape as
 * attendance: any Employee can create/view their own requests
 * (leave.view + leave.create); leave.view_all lists the whole company for
 * HR/CEO/managers, and leave.approve gates approving or rejecting a
 * request. Seeded by 0005_seed_hr_permissions.sql.
 */
export const LEAVE_PERMISSIONS = {
  VIEW: 'leave.view',
  VIEW_ALL: 'leave.view_all',
  CREATE: 'leave.create',
  APPROVE: 'leave.approve',
} as const;

/**
 * Permission codes for the Employee Master's Recruitment pipeline
 * (Module 8 — HR & Recruitment). HR-owned data, same shape as Employees:
 * no per-record scoping, since candidates aren't "owned" by anyone until
 * hired. Seeded by 0012_seed_recruitment_permissions.sql.
 */
export const RECRUITMENT_PERMISSIONS = {
  VIEW: 'recruitment.view',
  CREATE: 'recruitment.create',
  UPDATE: 'recruitment.update',
  DELETE: 'recruitment.delete',
} as const;

/**
 * Permission codes for Payroll (Module 10). Highly sensitive financial
 * data — no "own record" scoping is exposed here beyond what an Employee
 * can see of themselves via payroll.view; generating/approving a payroll
 * run stays with HR/Finance/CEO. Seeded by 0009_seed_payroll_permissions.sql.
 */
export const PAYROLL_PERMISSIONS = {
  VIEW: 'payroll.view',
  VIEW_ALL: 'payroll.view_all',
  GENERATE: 'payroll.generate',
  APPROVE: 'payroll.approve',
} as const;

/**
 * Permission codes for Vendors & Subscriptions (Module 11). Finance-owned
 * operational data. Seeded by 0010_seed_vendors_assets_permissions.sql.
 */
export const VENDOR_PERMISSIONS = {
  VIEW: 'vendors.view',
  CREATE: 'vendors.create',
  UPDATE: 'vendors.update',
  DELETE: 'vendors.delete',
} as const;

/**
 * Permission codes for Assets & IT (Module 12). Seeded by
 * 0010_seed_vendors_assets_permissions.sql.
 */
export const ASSET_PERMISSIONS = {
  VIEW: 'assets.view',
  CREATE: 'assets.create',
  UPDATE: 'assets.update',
  DELETE: 'assets.delete',
} as const;

/**
 * Permission codes for Company Goals & KPIs (Module 13). Read access is
 * broad (every manager should see how the company is tracking); only
 * CEO/Sales Manager can set/edit targets. Seeded by
 * 0011_seed_kpi_permissions.sql.
 */
export const KPI_PERMISSIONS = {
  VIEW: 'kpis.view',
  MANAGE: 'kpis.manage',
} as const;

/**
 * Permission codes for Projects & Operations (Module 5). Scoped by
 * project membership: an Employee sees projects they're a member of or
 * assigned tasks on via projects.view; projects.view_all gives the full
 * portfolio to CEO/Project Manager. Seeded by
 * 0008_seed_projects_permissions.sql.
 */
export const PROJECT_PERMISSIONS = {
  VIEW: 'projects.view',
  VIEW_ALL: 'projects.view_all',
  CREATE: 'projects.create',
  UPDATE: 'projects.update',
  DELETE: 'projects.delete',
} as const;

/** Task-level permissions — everyone can update their own assigned tasks. */
export const TASK_PERMISSIONS = {
  VIEW: 'tasks.view',
  CREATE: 'tasks.create',
  UPDATE: 'tasks.update',
  DELETE: 'tasks.delete',
} as const;

/**
 * Permission gating the AI Assistant (Module 21). A single "use" grant —
 * the assistant itself only ever reads data the caller could already see
 * through the normal API (it re-uses the same rbac checks per query), so
 * this permission just controls who gets the chat surface at all.
 */
export const AI_PERMISSIONS = {
  USE: 'ai.use',
} as const;

export async function getPermissionsForRole(roleId: string): Promise<string[]> {
  const { data, error } = await supabaseServer()
    .from('role_permissions')
    .select('permissions(code)')
    .eq('role_id', roleId);

  if (error || !data) return [];
  return data.map((row: any) => row.permissions.code);
}

export async function hasPermission(roleId: string, permissionCode: string): Promise<boolean> {
  const permissions = await getPermissionsForRole(roleId);
  return permissions.includes(permissionCode);
}

/** Throws if the role lacks the permission — use inside API routes. */
export async function requirePermission(roleId: string, permissionCode: string): Promise<void> {
  const allowed = await hasPermission(roleId, permissionCode);
  if (!allowed) {
    throw new Error(`Forbidden: role does not have permission "${permissionCode}"`);
  }
}