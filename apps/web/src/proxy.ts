import { SESSION_COOKIE_NAME } from '@pm/shared';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Fast redirect for protected pages when the browser has no session cookie at all.
 * This is only a convenience: it does not read or verify the token (the web app has no
 * JWT secret). The API decides on every request, and AuthGate checks /api/auth/me.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/projects/:path*', '/tasks/:path*'],
};
