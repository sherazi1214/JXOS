'use client';

// ============================================================================
// usePermissions — thin convenience wrapper around useAuth() that exposes a
// can(code) check for gating buttons/fields in the UI. Same caveat as
// useAuth: this is UX polish, not the security boundary.
// ============================================================================

import { useAuth } from '@/hooks/use-auth';

export function usePermissions() {
  const { permissions, user, loading } = useAuth();

  function can(code: string): boolean {
    return permissions.includes(code);
  }

  return { can, permissions, user, loading };
}
