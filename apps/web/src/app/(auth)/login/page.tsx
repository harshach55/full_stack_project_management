import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/LoginForm';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Log in</h1>
      <p className="mb-6 text-sm text-slate-600">Welcome back. Log in to manage your projects.</p>
      <LoginForm sessionExpired={reason === 'session-expired'} />
    </>
  );
}
