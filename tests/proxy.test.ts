// @vitest-environment node
//
// `proxy.ts` reads cookies off the incoming `NextRequest` and decides
// whether to let the request through, redirect to the silent-refresh
// route, or push the user to `/login`. The matcher pins the guard to
// `/admin/*` only — public routes are untouched by design.

import { NextRequest } from 'next/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/cookies';

import { config, decideGuardOutcome, proxy } from '@/proxy';

const TEST_ORIGIN = 'http://localhost:3000';

function buildRequest(path: string, cookies: Record<string, string> = {}): NextRequest {
  const url = new URL(path, TEST_ORIGIN);
  const headers = new Headers();
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  if (cookieHeader) headers.set('cookie', cookieHeader);
  return new NextRequest(url, { headers });
}

describe('proxy config matcher', () => {
  it('pins the guard to /admin/:path* only', () => {
    expect(config.matcher).toEqual(['/admin/:path*']);
  });
});

describe('decideGuardOutcome (pure decision function)', () => {
  it('returns "next" when the access cookie is present', () => {
    const result = decideGuardOutcome({
      hasAccess: true,
      hasRefresh: true,
      currentPath: '/admin/dashboard',
    });
    expect(result).toEqual({ kind: 'next' });
  });

  it('returns "next" when only the access cookie is present (no refresh)', () => {
    // Access alone is the minimum bar — the user has a live bearer and
    // is allowed to proceed even if the refresh token is gone.
    const result = decideGuardOutcome({
      hasAccess: true,
      hasRefresh: false,
      currentPath: '/admin/dashboard',
    });
    expect(result).toEqual({ kind: 'next' });
  });

  it('returns "refresh" with the current path when only the refresh cookie is present', () => {
    const result = decideGuardOutcome({
      hasAccess: false,
      hasRefresh: true,
      currentPath: '/admin/dashboard',
    });
    expect(result).toEqual({ kind: 'refresh', next: '/admin/dashboard' });
  });

  it('preserves nested admin paths in the refresh redirect target', () => {
    const result = decideGuardOutcome({
      hasAccess: false,
      hasRefresh: true,
      currentPath: '/admin/properties/123/edit',
    });
    expect(result).toEqual({ kind: 'refresh', next: '/admin/properties/123/edit' });
  });

  it('returns "login" when neither cookie is present', () => {
    const result = decideGuardOutcome({
      hasAccess: false,
      hasRefresh: false,
      currentPath: '/admin/dashboard',
    });
    expect(result).toEqual({ kind: 'login' });
  });
});

describe('proxy', () => {
  beforeEach(() => {
    // The proxy is a pure module — no env vars — but the test runner
    // carries a baseline to keep `vi` happy and to anchor the suite.
    vi.unstubAllEnvs();
  });

  it('lets the request through when the access cookie is present (NextResponse.next)', async () => {
    const request = buildRequest('/admin/dashboard', {
      [ACCESS_TOKEN_COOKIE]: 'jwt-access',
    });

    const response = await proxy(request, {} as never);

    // `NextResponse.next()` keeps the original status (200) and has
    // NO `Location` header — it's a pass-through, not a redirect.
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('redirects to /api/auth/refresh?next=<path> when only the refresh cookie is present', async () => {
    const request = buildRequest('/admin/dashboard', {
      [REFRESH_TOKEN_COOKIE]: 'uuid-refresh',
    });

    const response = await proxy(request, {} as never);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).not.toBeNull();
    // The redirect target is an absolute URL built from the request
    // origin so the client lands back on the same host.
    const target = new URL(location!);
    expect(target.origin).toBe(TEST_ORIGIN);
    expect(target.pathname).toBe('/api/auth/refresh');
    expect(target.searchParams.get('next')).toBe('/admin/dashboard');
  });

  it('preserves the original path in the refresh redirect for nested admin URLs', async () => {
    const request = buildRequest('/admin/properties/123/edit', {
      [REFRESH_TOKEN_COOKIE]: 'uuid-refresh',
    });

    const response = await proxy(request, {} as never);

    expect(response.status).toBe(307);
    const target = new URL(response.headers.get('location')!);
    expect(target.searchParams.get('next')).toBe('/admin/properties/123/edit');
  });

  it('redirects to /login when neither cookie is present', async () => {
    const request = buildRequest('/admin/dashboard');

    const response = await proxy(request, {} as never);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).not.toBeNull();
    const target = new URL(location!);
    expect(target.origin).toBe(TEST_ORIGIN);
    expect(target.pathname).toBe('/login');
  });

  it('does not touch /public/* routes via NextResponse.next when invoked directly (proxy is matcher-gated in production)', async () => {
    // This test exists as a regression guard: the proxy function itself
    // does NOT enforce the matcher (Next does at the framework level).
    // What we verify is that the guard logic only branches on cookie
    // presence — calling the function for a public path with NO cookies
    // still ends up redirecting to /login, which is harmless because
    // the matcher prevents it from ever running for those paths.
    const request = buildRequest('/buscar');

    const response = await proxy(request, {} as never);
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login');
  });
});
