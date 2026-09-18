'use client';

// ============================================================================
// Login page — two-step flow matching the product design:
//   1. Select your role (visual shortcut only, for a role-tailored form)
//   2. Enter email + password for that role
//
// Actual authorization always comes from the user's real role in the
// database (checked server-side in /api/auth/login and by RBAC on every
// request) — the role picked here is just a UX affordance, not a trust
// boundary. If the credentials belong to a different role than the one
// selected, we still log the user in and send them to their real dashboard.
// ============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crown,
  Users,
  DollarSign,
  Target,
  User as UserIcon,
  Loader2,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Gauge,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RoleOption = {
  key: string;
  label: string;
  description: string;
  icon: typeof Crown;
  ring: string;
  tint: string;
};

const ROLE_OPTIONS: RoleOption[] = [
  {
    key: 'CEO/Admin',
    label: 'CEO / Admin',
    description: 'Full access to all modules and company overview',
    icon: Crown,
    ring: 'hover:ring-primary/50 hover:border-primary/50',
    tint: 'text-primary-light bg-primary/10',
  },
  {
    key: 'HR',
    label: 'HR Manager',
    description: 'Access to HR, Payroll, Attendance and related modules',
    icon: Users,
    ring: 'hover:ring-emerald-400/40 hover:border-emerald-400/40',
    tint: 'text-emerald-300 bg-emerald-400/10',
  },
  {
    key: 'Finance',
    label: 'Finance Manager',
    description: 'Access to Finance, Invoices, Payments and Reports',
    icon: DollarSign,
    ring: 'hover:ring-amber-400/40 hover:border-amber-400/40',
    tint: 'text-amber-300 bg-amber-400/10',
  },
  {
    key: 'Sales Manager',
    label: 'Sales Manager',
    description: 'Access to CRM, Leads, Clients and Sales modules',
    icon: Target,
    ring: 'hover:ring-sky-400/40 hover:border-sky-400/40',
    tint: 'text-sky-300 bg-sky-400/10',
  },
  {
    key: 'Employee',
    label: 'Employee',
    description: 'Access to tasks, attendance and profile',
    icon: UserIcon,
    ring: 'hover:ring-teal-400/40 hover:border-teal-400/40',
    tint: 'text-teal-300 bg-teal-400/10',
  },
];

const HIGHLIGHTS = [
  {
    icon: Workflow,
    title: 'Every team, one workspace',
    description: 'CRM, Finance, HR and Projects — all connected, no spreadsheets.',
  },
  {
    icon: Gauge,
    title: 'Live company pulse',
    description: 'Revenue, pipeline and headcount refreshed the moment data changes.',
  },
  {
    icon: ShieldCheck,
    title: 'Access that fits the role',
    description: 'Everyone sees exactly what their role needs — nothing more.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Unable to sign in. Please try again.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setFormError('Something went wrong. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex">
      {/* ---------------------------------------------------------------- */}
      {/* Left — brand / marketing panel                                    */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between overflow-hidden border-r border-border px-12 py-10">
        <div className="aurora-blob -top-24 -left-24 h-72 w-72 bg-primary/30 animate-float" />
        <div className="aurora-blob top-1/3 -right-16 h-64 w-64 bg-accent/20 animate-float [animation-delay:-3s]" />
        <div className="aurora-blob bottom-0 left-1/4 h-56 w-56 bg-primary/10" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white font-bold shadow-glow-lg">
            J
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-white leading-none">Jasonex OS</p>
            <p className="text-[10.5px] text-muted leading-none mt-1">Business Operating System</p>
          </div>
        </div>

        <div className="relative animate-fade-in-up">
          <span className="pill-tab bg-white/5 text-muted border border-border mb-6">
            <Sparkles size={13} className="text-accent" />
            Built for growing teams
          </span>
          <h1 className="font-display text-4xl xl:text-[2.75rem] font-semibold text-white leading-[1.1] tracking-tight mb-4">
            Run your entire
            <br />
            business from{' '}
            <span className="heading-gradient">one place</span>.
          </h1>
          <p className="text-sm text-muted max-w-sm leading-relaxed mb-10">
            Sales, finance, people and projects — Jasonex OS keeps every
            department in sync so you spend less time chasing updates and
            more time making them.
          </p>

          <div className="space-y-4">
            {HIGHLIGHTS.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3 animate-fade-in-up"
                  style={{ animationDelay: `${120 * (i + 1)}ms` }}
                >
                  <span className="icon-tile h-9 w-9 bg-white/[0.06] border border-white/10 text-accent shrink-0">
                    <Icon size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white leading-tight">{item.title}</p>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="relative text-[11px] text-muted">
          © {new Date().getFullYear()} Jasonex Technologies. All rights reserved.
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Right — auth form                                                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="aurora-blob top-0 right-0 h-72 w-72 bg-primary/10 lg:hidden" />

        <div className="relative w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white font-bold shadow-glow">
              J
            </span>
            <h1 className="font-display text-xl font-semibold text-white">Jasonex OS</h1>
            <p className="text-muted text-sm mt-1">Business Operating System</p>
          </div>

          {!selectedRole ? (
            <div className="surface-panel p-6 sm:p-7 animate-fade-in-up">
              <h2 className="font-display text-xl font-semibold text-white mb-1">
                Welcome back <span className="inline-block animate-pulse-soft">👋</span>
              </h2>
              <p className="text-sm text-muted mb-6">Select your role to continue to your workspace</p>

              <div className="space-y-2.5">
                {ROLE_OPTIONS.map((role, i) => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.key}
                      onClick={() => setSelectedRole(role)}
                      style={{ animationDelay: `${60 * i}ms` }}
                      className={cn(
                        'group w-full flex items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-3 text-left ring-1 ring-transparent transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.04] hover:shadow-card-hover animate-fade-in-up',
                        role.ring
                      )}
                    >
                      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110', role.tint)}>
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-white">{role.label}</span>
                        <span className="block text-xs text-muted truncate">{role.description}</span>
                      </span>
                      <ArrowRight
                        size={15}
                        className="shrink-0 text-muted opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-white"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="surface-panel p-6 sm:p-7 animate-pop-in">
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="text-xs text-muted hover:text-white mb-5 inline-flex items-center gap-1 transition-colors"
              >
                ← Choose a different role
              </button>

              <div className="flex items-center gap-3 mb-6">
                <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', selectedRole.tint)}>
                  <selectedRole.icon size={20} />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-white leading-tight">{selectedRole.label}</h2>
                  <p className="text-xs text-muted">{selectedRole.description}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-muted mb-1.5" htmlFor="email">
                    Email
                  </label>
                  <div className="relative">
                    <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field pl-10"
                      placeholder="you@jasonextechnologies.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1.5" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field pl-10"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-muted cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="rounded border-border accent-primary"
                    />
                    Remember me
                  </label>
                  <a href="#" className="text-primary-light hover:text-primary hover:underline transition-colors">
                    Forgot Password?
                  </a>
                </div>

                {formError && (
                  <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5 animate-fade-in">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-gradient text-white text-sm font-medium py-2.5 shadow-glow transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  {isSubmitting ? 'Signing in…' : 'Login'}
                </button>

                <p className="text-center text-[11px] text-muted">
                  Secure login powered by Jasonex OS
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
