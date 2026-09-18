// ============================================================================
// "/" has no content of its own — this just sends people to the right
// place. In normal use middleware.ts already does this redirect before the
// request even gets here (logged-out -> /login, logged-in -> /dashboard),
// so this page is a fallback for the rare case a request reaches it anyway.
// ============================================================================

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? '/dashboard' : '/login');
}
