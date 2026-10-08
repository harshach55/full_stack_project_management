import type { AuthResponse, LoginInput, MeResponse, RegisterInput } from '@pm/shared';
import { apiRequest } from '@/lib/api-client';

// Web mode: no X-Client-Type header, so the API sets the httpOnly session cookie and the
// response body contains only the user, never the token (api-contract.md, section 2.5).

export const getMe = (signal?: AbortSignal) => apiRequest<MeResponse>('/auth/me', { signal });

export const login = (input: LoginInput) => apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input });

export const register = (input: RegisterInput) =>
  apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: input });

export const logout = () => apiRequest<void>('/auth/logout', { method: 'POST' });
