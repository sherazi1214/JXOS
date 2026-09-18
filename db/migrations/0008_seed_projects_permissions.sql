-- ============================================================================
-- 0008_seed_projects_permissions.sql
--
-- Seeds the `permissions` rows used by the Projects & Tasks module (see
-- src/lib/rbac.ts -> PROJECT_PERMISSIONS, TASK_PERMISSIONS) and wires them
-- up to the built-in roles. Idempotent — safe to run more than once.
--
--   projects.view       — see projects you're a member of, manage, or are
--                          the account manager of the client for
--   projects.view_all   — see every project in the company
--   projects.create     — create a project (manually, or later via a won
--                          contract)
--   projects.update     — edit project fields, status, budget/cost/revenue
--   projects.delete     — soft-delete a project
--
--   tasks.view          — see tasks on projects you can see
--   tasks.create        — add a task to a project
--   tasks.update        — edit a task, change its status/progress (also
--                          covers an Employee updating their own assigned
--                          tasks, scoped in the API by assigned_to)
--   tasks.delete        — remove a task
-- ============================================================================

INSERT INTO permissions (code, module, description) VALUES
  ('projects.view',      'projects', 'View projects you are a member of or manage'),
  ('projects.view_all',  'projects', 'View every project in the company'),
  ('projects.create',    'projects', 'Create a project'),
  ('projects.update',    'projects', 'Edit project fields and status'),
  ('projects.delete',    'projects', 'Soft-delete a project'),

  ('tasks.view',         'tasks', 'View tasks on projects you can see'),
  ('tasks.create',       'tasks', 'Add a task to a project'),
  ('tasks.update',       'tasks', 'Edit a task / change its status or progress'),
  ('tasks.delete',       'tasks', 'Remove a task')
ON CONFLICT (code) DO NOTHING;

-- CEO/Admin and Project Manager: full access across both modules.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('CEO/Admin', 'Project Manager')
  AND p.code IN (
    'projects.view', 'projects.view_all', 'projects.create', 'projects.update', 'projects.delete',
    'tasks.view', 'tasks.create', 'tasks.update', 'tasks.delete'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales Manager / Salesperson: read-only visibility into their own clients'
-- projects, to track delivery on deals they closed — never edits project
-- or task data, that's Operations' job.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Sales Manager', 'Salesperson')
  AND p.code IN ('projects.view', 'tasks.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Employee: sees and updates only the projects/tasks they're assigned to
-- (scoped server-side by project_members / project_tasks.assigned_to), can
-- create tasks for their own work but not delete projects.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Employee'
  AND p.code IN ('projects.view', 'tasks.view', 'tasks.create', 'tasks.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Finance/HR: no default access — projects/tasks aren't their working set.
