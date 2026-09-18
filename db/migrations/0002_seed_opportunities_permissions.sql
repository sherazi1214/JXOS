-- ============================================================================
-- 0002_seed_opportunities_permissions.sql
--
-- Seeds the `permissions` rows used by the Opportunities module (see
-- src/lib/rbac.ts -> OPPORTUNITY_PERMISSIONS) and wires them up to the
-- built-in roles. Idempotent — safe to run more than once.
--
--   opportunities.view      — see opportunities on leads assigned to you
--   opportunities.view_all  — see every opportunity in the company
--   opportunities.create    — open a new opportunity on a lead
--   opportunities.update    — edit value/probability/status/close date
--   opportunities.delete    — remove an opportunity
-- ============================================================================

INSERT INTO permissions (code, module, description) VALUES
  ('opportunities.view',      'crm', 'View opportunities on your own leads'),
  ('opportunities.view_all',  'crm', 'View every opportunity in the company'),
  ('opportunities.create',    'crm', 'Open a new opportunity on a lead'),
  ('opportunities.update',    'crm', 'Edit an opportunity (value, probability, status, close date)'),
  ('opportunities.delete',    'crm', 'Delete an opportunity')
ON CONFLICT (code) DO NOTHING;

-- CEO/Admin and Sales Manager: full access, including cross-team visibility.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('CEO/Admin', 'Sales Manager')
  AND p.code IN ('opportunities.view', 'opportunities.view_all', 'opportunities.create', 'opportunities.update', 'opportunities.delete')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Salesperson: own opportunities only — view/create/update, no delete, no
-- cross-team visibility.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Salesperson'
  AND p.code IN ('opportunities.view', 'opportunities.create', 'opportunities.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;
