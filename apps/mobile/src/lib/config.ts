/**
 * API base URL from EXPO_PUBLIC_API_URL (embedded in the bundle at build time; see .env.example).
 * Returns null when it is missing or not a plain origin, so the app can show a setup message
 * instead of calling a wrong address. There is deliberately no default URL.
 */
export function resolveApiBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^/\s?#]+$/i.test(trimmed)) return null;
  return trimmed;
}

// Expo replaces process.env.EXPO_PUBLIC_* references with their values when bundling.
export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
