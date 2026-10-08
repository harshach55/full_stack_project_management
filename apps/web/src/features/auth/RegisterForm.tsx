'use client';

import { LIMITS, registerBodySchema } from '@pm/shared';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Fields';
import { Alert } from '@/components/ui/States';
import { isApiError } from '@/lib/api-client';
import { errorMessage, serverFieldErrors } from '@/lib/error-messages';
import { validateForm, type FieldErrors } from '@/lib/form';
import { useRegister } from './hooks';

export function RegisterForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const register = useRegister();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(registerBodySchema, { fullName, email, password });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    register.mutate(result.data, {
      onError: (error) => {
        const fieldErrors = serverFieldErrors(error);
        // A duplicate email is shown next to the email field.
        if (isApiError(error) && error.code === 'EMAIL_ALREADY_EXISTS') {
          fieldErrors.email = errorMessage(error);
        }
        setErrors(fieldErrors);
      },
    });
  };

  const showBanner = register.isError && Object.keys(errors).length === 0;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {showBanner && <Alert>{errorMessage(register.error)}</Alert>}
      <TextField
        label="Full name"
        autoComplete="name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        error={errors.fullName}
        maxLength={LIMITS.fullNameMax}
        required
      />
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
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
        hint={`At least ${LIMITS.passwordMinBytes} characters (at most ${LIMITS.passwordMaxBytes} bytes).`}
        required
      />
      <Button type="submit" className="w-full" loading={register.isPending}>
        Create account
      </Button>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-blue-700 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
