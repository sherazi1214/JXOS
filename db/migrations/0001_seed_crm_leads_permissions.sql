-- ============================================================================
-- 0001_seed_crm_leads_permissions.sql
--
-- Seeds the `permissions` rows used by the CRM/Leads module (see
-- src/lib/rbac.ts -> LEAD_PERMISSIONS) and wires them up to the built-in
-- roles from db/schema.sql. Idempotent — safe to run more than once.
--
--   leads.view      — see leads assigned to you
--   leads.view_all  — see every lead in the company (not just your own)
--   leads.create    — create new leads
--   leads.update    — edit lead fields / log activities
--   leads.delete    — soft-delete a lead
--   leads.assign    — assign/reassign a lead to a salesperson
-- ============================================================================

INSERT INTO permissions (code, module, description) VALUES
  ('leads.view',      'crm', 'View leads assigned to you'),
  ('leads.view_all',  'crm', 'View every lead in the company'),
  ('leads.create',    'crm', 'Create new leads'),
  ('leads.update',    'crm', 'Edit lead fields and log activities'),
  ('leads.delete',    'crm', 'Soft-delete a lead'),
  ('leads.assign',    'crm', 'Assign or reassign a lead to a salesperson')
ON CONFLICT (code) DO NOTHING;

-- CEO/Admin and Sales Manager: full access, including cross-team visibility
-- and reassignment.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('CEO/Admin', 'Sales Manager')
  AND p.code IN ('leads.view', 'leads.view_all', 'leads.create', 'leads.update', 'leads.delete', 'leads.assign')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Salesperson: own leads only — view/create/update, no delete, no
-- cross-team visibility, no reassignment.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Salesperson'
  AND p.code IN ('leads.view', 'leads.create', 'leads.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;
