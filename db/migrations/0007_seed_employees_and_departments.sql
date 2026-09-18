-- ============================================================================
-- 0007_seed_employees_and_departments.sql
--
-- Seeds `permissions` for the Employee Master (see rbac.ts ->
-- EMPLOYEE_PERMISSIONS) and a starter set of `departments`, referenced by
-- employees.department_id (and later by expenses.department_id, projects,
-- etc). Idempotent — safe to run more than once.
--
--   employees.view      — see your own employee record
--   employees.view_all  — see the full employee roster
--   employees.create    — add a new employee
--   employees.update    — edit an employee's record
--   employees.delete    — soft-delete (offboard) an employee
-- ============================================================================

INSERT INTO permissions (code, module, description) VALUES
  ('employees.view',      'hr', 'View your own employee record'),
  ('employees.view_all',  'hr', 'View the full employee roster'),
  ('employees.create',    'hr', 'Add a new employee'),
  ('employees.update',    'hr', 'Edit an employee record'),
  ('employees.delete',    'hr', 'Soft-delete (offboard) an employee')
ON CONFLICT (code) DO NOTHING;

-- CEO/Admin and HR: full roster access and management rights.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('CEO/Admin', 'HR')
  AND p.code IN ('employees.view', 'employees.view_all', 'employees.create', 'employees.update', 'employees.delete')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Project Manager: read-only roster visibility, to staff projects.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Project Manager'
  AND p.code IN ('employees.view', 'employees.view_all')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Everyone else: only their own record.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Finance', 'Sales Manager', 'Salesperson', 'Employee')
  AND p.code = 'employees.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO departments (name) VALUES
  ('Engineering'),
  ('Sales'),
  ('Marketing'),
  ('HR'),
  ('Finance'),
  ('Operations'),
  ('Management')
ON CONFLICT (name) DO NOTHING;
