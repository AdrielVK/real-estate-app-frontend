// @vitest-environment node
//
// `proxy.ts` reads cookies off the incoming `NextRequest` and decides
// whether to let the request through, redirect to the silent-refresh
// route, redirect to `/` (denied for non-privileged roles), or push
// the user to `/login` (no session at all). The matcher pins the
// guard to `/admin/*` only — public routes are untouched by design.

import { NextRequest } from 'next/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/cookies';

import { config, decideGuardOutcome, proxy } from '@/proxy';

const TEST_ORIGIN = 'http://localhost:3000';

function base64url(value: string): string {
  return btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeJwt(payload: unknown): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

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
  it('returns "next" when the role is privileged (regardless of refresh cookie)', () => {
    // Spec "Privileged role" scenario — AGENT/ADMIN/ADMINISTRATIVE
    // bypass the role check. The function still surfaces the next
    // outcome so the proxy lets the request through.
    const result = decideGuardOutcome({
      hasAccess: true,
      hasRefresh: true,
      currentPath: '/admin/dashboard',
      role: 'AGENT',
    });
    expect(result).toEqual({ kind: 'next' });
  });

  it('returns "next" when the role is ADMIN (privileged subset)', () => {
    const result = decideGuardOutcome({
      hasAccess: true,
      hasRefresh: false,
      currentPath: '/admin/dashboard',
      role: 'ADMIN',
    });
    expect(result).toEqual({ kind: 'next' });
  });

  it('returns "next" when the role is ADMINISTRATIVE (privileged subset)', () => {
    const result = decideGuardOutcome({
      hasAccess: true,
      hasRefresh: false,
      currentPath: '/admin/properties',
      role: 'ADMINISTRATIVE',
    });
    expect(result).toEqual({ kind: 'next' });
  });

  it('returns "denied" (redirect to /) when the role is CLIENT (non-privileged)', () => {
    // Spec "Non-privileged role" — a CLIENT token hits /admin and
    // the proxy redirects to `/` (not `/login`, per design D4 — a
    // valid session bouncing to /login is confusing).
    const result = decideGuardOutcome({
      hasAccess: true,
      hasRefresh: true,
      currentPath: '/admin/dashboard',
      role: 'CLIENT',
    });
    expect(result).toEqual({ kind: 'denied' });
  });

  it('returns "denied" (redirect to /) when the role claim is missing (fail-closed)', () => {
    // Spec "Missing role claim" — a token without a `role` claim
    // MUST NOT pass. The role field is `unknown` upstream; any
    // non-privileged value is a denial.
    const result = decideGuardOutcome({
      hasAccess: true,
      hasRefresh: true,
      currentPath: '/admin/dashboard',
      role: undefined,
    });
    expect(result).toEqual({ kind: 'denied' });
  });

  it('returns "denied" when the role is an unknown string (defense against backend drift)', () => {
    // A future role the proxy doesn't recognize must fail closed,
    // not pass through. The decoder returns `unknown`; the proxy
    // narrows via isPrivilegedRole; anything else is denied.
    const result = decideGuardOutcome({
      hasAccess: true,
      hasRefresh: true,
      currentPath: '/admin/dashboard',
      role: 'SUPERUSER',
    });
    expect(result).toEqual({ kind: 'denied' });
  });

  it('returns "denied" when the role is a non-string (number, object)', () => {
    // The decoder surfaces `unknown`; a malicious backend could
    // emit `role: 42` or `role: { admin: true }`. Both must fail
    // closed.
    const resultNumeric = decideGuardOutcome({
      hasAccess: true,
      hasRefresh: false,
      currentPath: '/admin/dashboard',
      role: 42,
    });
    expect(resultNumeric).toEqual({ kind: 'denied' });

    const resultObject = decideGuardOutcome({
      hasAccess: true,
      hasRefresh: false,
      currentPath: '/admin/dashboard',
      role: { admin: true },
    });
    expect(resultObject).toEqual({ kind: 'denied' });
  });

  it('returns "refresh" with the current path when only the refresh cookie is present (no regression)', () => {
    // No access cookie → the role branch is irrelevant. The legacy
    // silent-refresh chain is preserved.
    const result = decideGuardOutcome({
      hasAccess: false,
      hasRefresh: true,
      currentPath: '/admin/dashboard',
      role: undefined,
    });
    expect(result).toEqual({ kind: 'refresh', next: '/admin/dashboard' });
  });

  it('preserves nested admin paths in the refresh redirect target', () => {
    const result = decideGuardOutcome({
      hasAccess: false,
      hasRefresh: true,
      currentPath: '/admin/properties/123/edit',
      role: undefined,
    });
    expect(result).toEqual({ kind: 'refresh', next: '/admin/properties/123/edit' });
  });

  it('returns "login" when neither cookie is present (no regression)', () => {
    const result = decideGuardOutcome({
      hasAccess: false,
      hasRefresh: false,
      currentPath: '/admin/dashboard',
      role: undefined,
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

  it('lets the request through when the access cookie decodes to a privileged role (NextResponse.next)', async () => {
    const request = buildRequest('/admin/dashboard', {
      [ACCESS_TOKEN_COOKIE]: makeJwt({ role: 'AGENT' }),
    });

    const response = await proxy(request, {} as never);

    // `NextResponse.next()` keeps the original status (200) and has
    // NO `Location` header — it's a pass-through, not a redirect.
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('redirects to / (denied) when the access cookie decodes to a CLIENT role', async () => {
    // Spec "Non-privileged role" — CLIENT hits /admin and the proxy
    // redirects to `/` (not `/login`, per design D4).
    const request = buildRequest('/admin/dashboard', {
      [ACCESS_TOKEN_COOKIE]: makeJwt({ role: 'CLIENT' }),
    });

    const response = await proxy(request, {} as never);

    expect(response.status).toBe(307);
    const target = new URL(response.headers.get('location')!);
    expect(target.origin).toBe(TEST_ORIGIN);
    expect(target.pathname).toBe('/');
  });

  it('redirects to / (denied) when the access cookie decodes without a role claim (fail-closed)', async () => {
    // Spec "Missing role claim" — no role, no pass.
    const request = buildRequest('/admin/dashboard', {
      [ACCESS_TOKEN_COOKIE]: makeJwt({ sub: 'user-1' }),
    });

    const response = await proxy(request, {} as never);

    expect(response.status).toBe(307);
    const target = new URL(response.headers.get('location')!);
    expect(target.pathname).toBe('/');
  });

  it('redirects to / (denied) when the access cookie is undecodable (fail-closed)', async () => {
    // Spec "Undecodable access token" — a malformed token (not a
    // JWT) is denied, not refreshed. Refresh is reserved for
    // "token expired but the user has a refresh cookie" — a
    // malformed token has no chain to follow.
    const request = buildRequest('/admin/dashboard', {
      [ACCESS_TOKEN_COOKIE]: 'not-a-jwt',
    });

    const response = await proxy(request, {} as never);

    expect(response.status).toBe(307);
    const target = new URL(response.headers.get('location')!);
    expect(target.pathname).toBe('/');
  });

  it('redirects to /api/auth/refresh?next=<path> when only the refresh cookie is present (no regression)', async () => {
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
