'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/States';
import { useAuthenticatedUser } from '@/features/auth/AuthGate';
import { useLogout } from '@/features/auth/hooks';
import { errorMessage } from '@/lib/error-messages';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/tasks', label: 'Tasks' },
];

/** Header with navigation and the user menu for every protected page. */
export function AppShell({ children }: { children: ReactNode }) {
  const user = useAuthenticatedUser();
  const pathname = usePathname();
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-semibold text-slate-900">
            Project Manager
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <Button variant="secondary" onClick={() => logout.mutate()} loading={logout.isPending}>
              Log out
            </Button>
          </div>
          <nav aria-label="Main" className="w-full">
            <ul className="flex flex-wrap gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`block rounded-md px-3 py-2 text-sm font-medium ${
                        active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {logout.isError && (
          <div className="mb-4">
            <Alert>Could not log out: {errorMessage(logout.error)}</Alert>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
