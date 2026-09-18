-- ============================================================================
-- 0013_seed_ai_permissions.sql
--
-- Seeds the `permissions` row for the AI Assistant (Module 21, see rbac.ts
-- -> AI_PERMISSIONS) and wires it up to every built-in role. Idempotent —
-- safe to run more than once.
--
-- This permission was never seeded anywhere in the repo (not in
-- schema.sql, not in any migration), which is why /ai-assistant always
-- showed "Access Restricted" for every role, including CEO/Admin — the
-- page and API route were fully wired up, but hasPermission() had no
-- 'ai.use' row to find for any role.
--
--   ai.use — open the AI Assistant chat surface. The assistant itself is
--            read-only and only ever sees data the caller's OTHER
--            permissions already allow (re-checked per query in
--            /api/ai), so granting this to everyone is safe.
-- ============================================================================

INSERT INTO permissions (code, module, description) VALUES
  ('ai.use', 'ai', 'Use the AI Assistant chat')
ON CONFLICT (code) DO NOTHING;

-- Every built-in role gets the chat surface — the sidebar shows it to
-- 'all' roles (see components/shared/sidebar.tsx), and the assistant's
-- own context builder already narrows what data it can talk about based
-- on each user's other permissions.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN (
    'CEO/Admin', 'HR', 'Finance', 'Sales Manager', 'Salesperson',
    'Project Manager', 'Employee'
  )
  AND p.code = 'ai.use'
ON CONFLICT (role_id, permission_id) DO NOTHING;