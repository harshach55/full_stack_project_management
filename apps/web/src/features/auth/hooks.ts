'use client';

import type { AuthResponse, LoginInput, RegisterInput } from '@pm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { isApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import * as authApi from './api';

/** The current user according to GET /api/auth/me; the API is the authority on the session. */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => authApi.getMe(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

function useStartSession() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return (response: AuthResponse) => {
    // Drop anything cached for a previous user, then remember the new one.
    queryClient.clear();
    queryClient.setQueryData(queryKeys.me, { user: response.user });
    router.replace('/dashboard');
  };
}

export function useLogin() {
  const startSession = useStartSession();
  return useMutation({ mutationFn: (input: LoginInput) => authApi.login(input), onSuccess: startSession });
}

export function useRegister() {
  const startSession = useStartSession();
  return useMutation({ mutationFn: (input: RegisterInput) => authApi.register(input), onSuccess: startSession });
}

/** Logs out this browser session only; other devices stay logged in (PD-18). */
export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const finish = () => {
    queryClient.clear();
    router.replace('/login');
  };
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: finish,
    onError: (error) => {
      // A session that already ended is as good as logged out.
      if (isApiError(error) && error.status === 401) finish();
    },
  });
}
