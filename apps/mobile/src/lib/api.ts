import { createApiClient } from './api-client';
import { API_BASE_URL } from './config';
import { createSessionController } from './session-controller';
import { secureTokenStore } from './token-storage';

/** The app-wide API client (null when EXPO_PUBLIC_API_URL is not configured). */
export const api = API_BASE_URL ? createApiClient({ baseUrl: API_BASE_URL, getToken: secureTokenStore.get }) : null;

export const session = api ? createSessionController(api, secureTokenStore) : null;

/** The configured client; screens only render after configuration was checked. */
export function useApi() {
  if (!api) throw new Error('EXPO_PUBLIC_API_URL is not configured');
  return api;
}
