'use client';

import { loginBodySchema } from '@pm/shared';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Fields';
import { Alert, Notice } from '@/components/ui/States';
import { errorMessage, serverFieldErrors } from '@/lib/error-messages';
import { validateForm, type FieldErrors } from '@/lib/form';
import { useLogin } from './hooks';

export function LoginForm({ sessionExpired = false }: { sessionExpired?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const login = useLogin();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(loginBodySchema, { email, password });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    login.mutate(result.data, { onError: (error) => setErrors(serverFieldErrors(error)) });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {sessionExpired && !login.isError && <Notice>Your session has expired. Please log in again.</Notice>}
      {login.isError && Object.keys(serverFieldErrors(login.error)).length === 0 && <Alert>{errorMessage(login.error)}</Alert>}
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
        required
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
        required
      />
      <Button type="submit" className="w-full" loading={login.isPending}>
        Log in
      </Button>
      <p className="text-center text-sm text-slate-600">
        No account yet?{' '}
        <Link href="/register" className="font-medium text-blue-700 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
