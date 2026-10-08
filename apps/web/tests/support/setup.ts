import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

let currentPathname = '/dashboard';
export function setPathname(pathname: string) {
  currentPathname = pathname;
  window.history.replaceState({}, '', pathname);
}

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => currentPathname,
  redirect: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const fn of Object.values(router)) fn.mockReset();
  setPathname('/dashboard');
});
