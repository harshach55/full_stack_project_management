import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/layout/AppShell';
import { AuthGate } from '@/features/auth/AuthGate';
import { LoginForm } from '@/features/auth/LoginForm';
import { RegisterForm } from '@/features/auth/RegisterForm';
import * as session from '@/lib/session';
import { router, setPathname } from './support/setup';
import { apiError, json, mockApi, on, renderWithClient, USER } from './support/test-utils';

describe('LoginForm', () => {
  it('validates fields before calling the API', async () => {
    const { requests } = mockApi();
    renderWithClient(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    // An empty field is an empty string, which the shared email rule reports as invalid.
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toHaveLength(0);
  });

  it('logs in through /api with the cookie and goes to the dashboard', async () => {
    const { requests } = mockApi(on('POST', '/api/auth/login', () => json(200, { user: USER })));
    renderWithClient(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/Email/), '  Alice@Example.com ');
    await userEvent.type(screen.getByLabelText(/Password/), 'correct-horse-battery');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/dashboard'));
    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: '/api/auth/login',
      credentials: 'include',
      body: { email: 'alice@example.com', password: 'correct-horse-battery' },
    });
    // Web mode: no client-type header, so the API answers with a cookie, never a token.
    expect(requests[0]!.headers).not.toHaveProperty('X-Client-Type');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('shows invalid credentials without redirecting', async () => {
    mockApi(on('POST', '/api/auth/login', () => apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')));
    setPathname('/login');
    renderWithClient(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/Email/), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/Password/), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('explains rate limiting', async () => {
    mockApi(on('POST', '/api/auth/login', () => apiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.')));
    setPathname('/login');
    renderWithClient(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/Email/), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/Password/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Too many attempts/);
  });

  it('explains network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    setPathname('/login');
    renderWithClient(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/Email/), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/Password/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Cannot reach the server/);
  });

  it('shows the session-expired message after a redirect', () => {
    renderWithClient(<LoginForm sessionExpired />);
    expect(screen.getByRole('status')).toHaveTextContent('Your session has expired. Please log in again.');
  });
});

describe('RegisterForm', () => {
  it('applies the shared validation rules', async () => {
    const { requests } = mockApi();
    renderWithClient(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/Full name/), '   ');
    await userEvent.type(screen.getByLabelText(/Email/), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/Password/), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Full name is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password must be 8 to 72 bytes long.')).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('registers and goes to the dashboard', async () => {
    const { requests } = mockApi(on('POST', '/api/auth/register', () => json(201, { user: USER })));
    renderWithClient(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/Full name/), 'Alice Example');
    await userEvent.type(screen.getByLabelText(/Email/), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/Password/), 'correct-horse-battery');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/dashboard'));
    expect(requests[0]!.body).toEqual({ fullName: 'Alice Example', email: 'alice@example.com', password: 'correct-horse-battery' });
  });

  it('shows a duplicate email next to the email field', async () => {
    mockApi(on('POST', '/api/auth/register', () => apiError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists.')));
    setPathname('/register');
    renderWithClient(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/Full name/), 'Alice');
    await userEvent.type(screen.getByLabelText(/Email/), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/Password/), 'correct-horse-battery');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('session handling', () => {
  it('renders the protected area after /api/auth/me confirms the session', async () => {
    mockApi(on('GET', '/api/auth/me', () => json(200, { user: USER })));
    renderWithClient(
      <AuthGate>
        <AppShell>
          <p>Protected content</p>
        </AppShell>
      </AuthGate>,
    );
    expect(screen.getByText('Checking your session...')).toBeInTheDocument();
    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    expect(screen.getByText('Alice Example')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['TOKEN_EXPIRED', '/login?reason=session-expired'],
    ['TOKEN_REVOKED', '/login?reason=session-expired'],
    ['UNAUTHENTICATED', '/login'],
  ])('redirects to login when /api/auth/me returns %s', async (code, target) => {
    const redirect = vi.spyOn(session, 'redirectToLogin').mockImplementation(() => {});
    mockApi(on('GET', '/api/auth/me', () => apiError(401, code, 'Session problem.')));
    renderWithClient(
      <AuthGate>
        <p>Protected content</p>
      </AuthGate>,
    );
    await waitFor(() => expect(redirect).toHaveBeenCalledWith(target));
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    redirect.mockRestore();
  });

  it('offers a retry when the session check fails for another reason', async () => {
    mockApi(on('GET', '/api/auth/me', () => apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')));
    renderWithClient(
      <AuthGate>
        <p>Protected content</p>
      </AuthGate>,
    );
    expect(await screen.findByText('Could not check your session', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('logs out, clears cached data and returns to login', async () => {
    const { requests } = mockApi(
      on('GET', '/api/auth/me', () => json(200, { user: USER })),
      on('POST', '/api/auth/logout', () => json(204)),
    );
    const { client } = renderWithClient(
      <AuthGate>
        <AppShell>
          <p>Protected content</p>
        </AppShell>
      </AuthGate>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(requests.find((r) => r.path === '/api/auth/logout')).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(client.getQueryData(['me'])).toBeUndefined();
  });
});
