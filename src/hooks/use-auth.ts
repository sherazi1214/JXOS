'use client';

// ============================================================================
// useAuth — fetches the current user + their permission codes from
// /api/auth/me once per mount. Used by client components to tailor the UI
// (e.g. hide a control a role can't use). Never treat this as the security
// boundary — every API route re-checks permissions server-side via rbac.ts.
// ============================================================================

import { useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  role_id: string;
  employee_id: string | null;
}

interface AuthState {
  user: AuthUser | null;
  permissions: string[];
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, permissions: [], loading: true });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setState({
          user: data?.user ?? null,
          permissions: data?.permissions ?? [],
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ user: null, permissions: [], loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
