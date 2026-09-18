// ============================================================================
// Dashboard shell — wraps every page under (dashboard)/* with the sidebar
// and topbar. Server Component: re-checks the session on every navigation
// (not just at the edge in middleware.ts), so this is the real auth gate.
// ============================================================================

import { redirect } from 'next/navigation';
import { getCurrentUserWithRole } from '@/lib/auth';
import Sidebar from '@/components/shared/sidebar';
import Topbar from '@/components/shared/topbar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserWithRole();
  if (!user) redirect('/login');

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar role={user.roleName} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          user={{
            name: user.full_name,
            role: user.roleName,
            avatarUrl: user.avatar_url,
          }}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
