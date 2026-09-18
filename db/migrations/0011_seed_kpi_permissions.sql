-- ============================================================================
-- 0011_seed_kpi_permissions.sql
--
-- Seeds `permissions` rows for Company Goals & KPIs (Module 13, see
-- rbac.ts -> KPI_PERMISSIONS) and wires them up to the built-in roles.
-- Idempotent — safe to run more than once.
--
-- This migration was referenced by rbac.ts comments but was missing from
-- the repo, which is why every role — including CEO/Admin — saw "Access
-- Restricted" on /kpis even though the page and API routes were fully
-- wired up — hasPermission() had nothing to find.
--
--   kpis.view    — see targets vs. actuals and achievement %
--   kpis.manage  — set/edit targets and update actual values
-- ============================================================================

INSERT INTO permissions (code, module, description) VALUES
  ('kpis.view',   'strategy', 'View company goals, targets and achievement %'),
  ('kpis.manage', 'strategy', 'Set targets and update actual values')
ON CONFLICT (code) DO NOTHING;

-- CEO/Admin and Sales Manager can both set/edit targets.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('CEO/Admin', 'Sales Manager')
  AND p.code IN ('kpis.view', 'kpis.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Everyone else: read-only visibility into how the company is tracking.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('HR', 'Finance', 'Salesperson', 'Project Manager', 'Employee')
  AND p.code = 'kpis.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;