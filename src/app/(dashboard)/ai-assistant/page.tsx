// ============================================================================
// /ai-assistant — AI CEO/Sales/Finance/Operations Assistant (Module 21).
// Server Component: real ai.use permission check before handing off to the
// interactive chat shell.
// ============================================================================

import { getCurrentUserWithRole } from '@/lib/auth';
import { hasPermission, AI_PERMISSIONS } from '@/lib/rbac';
import { AiAssistantClient } from '@/components/ai/ai-assistant-client';

export default async function AiAssistantPage() {
  const user = await getCurrentUserWithRole();
  const allowed = user ? await hasPermission(user.role_id, AI_PERMISSIONS.USE) : false;

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Access Restricted</h1>
        <p className="text-sm text-muted mt-1">
          Your role doesn&apos;t have permission to use the AI Assistant. Contact your
          administrator if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <AiAssistantClient roleName={user!.roleName} />;
}
