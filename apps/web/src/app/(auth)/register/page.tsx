import type { Metadata } from 'next';
import { RegisterForm } from '@/features/auth/RegisterForm';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Create account</h1>
      <p className="mb-6 text-sm text-slate-600">Register to start managing projects and tasks.</p>
      <RegisterForm />
    </>
  );
}
