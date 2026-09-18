-- ============================================================================
-- 0012_seed_recruitment_permissions.sql
--
-- Seeds `permissions` rows for the Recruitment pipeline (see rbac.ts ->
-- RECRUITMENT_PERMISSIONS) and wires them up to the built-in roles.
-- Idempotent — safe to run more than once.
--
--   recruitment.view    — see the candidate pipeline
--   recruitment.create  — add a new candidate application
--   recruitment.update  — move a candidate through stages, edit their record
--   recruitment.delete  — remove a candidate (e.g. duplicate/spam application)
--
-- HR-owned data, no per-record scoping — candidates aren't "owned" by
-- anyone until they're hired, at which point POST /api/recruitment/:id/hire
-- (recruitment.update + employees.create) converts them into an Employee
-- record, mirroring the Lead -> Client convert flow in the CRM module.
-- ============================================================================

INSERT INTO permissions (code, module, description) VALUES
  ('recruitment.view',    'hr', 'View the candidate pipeline'),
  ('recruitment.create',  'hr', 'Add a new candidate application'),
  ('recruitment.update',  'hr', 'Edit a candidate / move them through stages'),
  ('recruitment.delete',  'hr', 'Remove a candidate')
ON CONFLICT (code) DO NOTHING;

-- CEO/Admin and HR: full pipeline access.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('CEO/Admin', 'HR')
  AND p.code IN ('recruitment.view', 'recruitment.create', 'recruitment.update', 'recruitment.delete')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Project Manager / department heads: read-only, to weigh in on hiring for
-- their own team without editing the pipeline.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Project Manager'
  AND p.code = 'recruitment.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
