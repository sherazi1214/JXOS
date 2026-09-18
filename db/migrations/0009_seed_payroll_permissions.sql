-- ============================================================================
-- 0009_seed_payroll_permissions.sql
--
-- Seeds `permissions` rows for Payroll & Compensation (see rbac.ts ->
-- PAYROLL_PERMISSIONS) and wires them up to the built-in roles. Idempotent —
-- safe to run more than once.
--
--   payroll.view      — see your own payroll records
--   payroll.view_all  — see every employee's payroll
--   payroll.generate  — run payroll for a period (pulls salary, commissions,
--                        bonuses, overtime from attendance) and edit draft rows
--   payroll.approve   — approve a draft run, or lock an approved one
-- ============================================================================

INSERT INTO permissions (code, module, description) VALUES
  ('payroll.view',      'hr', 'View your own payroll records'),
  ('payroll.view_all',  'hr', 'View every employee''s payroll'),
  ('payroll.generate',  'hr', 'Generate/edit a draft payroll run for a period'),
  ('payroll.approve',   'hr', 'Approve or lock a payroll run')
ON CONFLICT (code) DO NOTHING;

-- CEO/Admin: full access, including approval/locking.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'CEO/Admin'
  AND p.code IN ('payroll.view', 'payroll.view_all', 'payroll.generate', 'payroll.approve')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR and Finance: generate and view company-wide, but approval is a
-- deliberate second set of eyes — both roles get it since either might run
-- payroll depending on company size.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('HR', 'Finance')
  AND p.code IN ('payroll.view', 'payroll.view_all', 'payroll.generate', 'payroll.approve')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Everyone else: only their own payslip, once approved/locked.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Sales Manager', 'Salesperson', 'Project Manager', 'Employee')
  AND p.code = 'payroll.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
