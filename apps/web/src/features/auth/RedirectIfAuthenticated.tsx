'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCurrentUser } from './hooks';

/**
 * On the login and register pages: if the API confirms an active session, go to the
 * dashboard. The forms stay usable while this check runs, and a 401 simply keeps the user
 * here, so an expired cookie can never cause a redirect loop.
 */
export function RedirectIfAuthenticated() {
  const router = useRouter();
  const { data } = useCurrentUser();
  useEffect(() => {
    if (data?.user) router.replace('/dashboard');
  }, [data, router]);
  return null;
}
