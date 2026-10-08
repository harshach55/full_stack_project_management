import type { ReactNode } from 'react';
import { RedirectIfAuthenticated } from '@/features/auth/RedirectIfAuthenticated';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <RedirectIfAuthenticated />
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
    </main>
  );
}
