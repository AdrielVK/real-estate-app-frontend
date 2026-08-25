// @vitest-environment node
//
// `admin-session.ts` resolves the admin-zone user from the access
// token cookie. Run under Node so the decoder runs in the same
// runtime as the RSC and proxy consumers.

import { describe, expect, it } from 'vitest';

import { resolveAdminUser } from '@/lib/auth/admin-session';

function base64url(value: string): string {
  // `atob` is the Web base64 decoder; mirrors the test helper in
  // `auth-jwt.test.ts` without the Node-only `Buffer` path so the
  // fixture uses the same edge-safe encoder the production decoder
  // will reverse.
  return btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeJwt(payload: unknown): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe('resolveAdminUser', () => {
  it('returns null when the access token is undefined (no cookie)', () => {
    expect(resolveAdminUser(undefined)).toBeNull();
  });

  it('returns null when the access token is empty', () => {
    expect(resolveAdminUser('')).toBeNull();
  });

  it('returns null when the access token is malformed (not a JWT)', () => {
    expect(resolveAdminUser('not-a-jwt')).toBeNull();
  });

  it('returns null when the payload has no role claim (fail-closed)', () => {
    // The admin guard contract: without a role claim the user cannot
    // be authorized. resolveAdminUser mirrors that — better to surface
    // a null than to let the layout render an unprivileged user.
    const token = makeJwt({ sub: 'user-1', username: 'ana' });
    expect(resolveAdminUser(token)).toBeNull();
  });

  it('returns null when the role is non-privileged (CLIENT)', () => {
    // Spec "Non-privileged role" — CLIENT must never reach the
    // admin zone. resolveAdminUser is the RSC-side mirror of the
    // proxy guard, so the same fail-closed policy applies.
    const token = makeJwt({ sub: 'user-1', username: 'ana', role: 'CLIENT' });
    expect(resolveAdminUser(token)).toBeNull();
  });

  it('returns null when the role is unknown (defense against backend drift)', () => {
    // The decoder is typed as `unknown` upstream; an unknown role
    // must fail closed.
    const token = makeJwt({ sub: 'user-1', username: 'ana', role: 'SUPERUSER' });
    expect(resolveAdminUser(token)).toBeNull();
  });

  it('returns { displayName, role } for a privileged token with username', () => {
    const token = makeJwt({ sub: 'user-1', username: 'ana', role: 'ADMIN' });
    expect(resolveAdminUser(token)).toEqual({ displayName: 'ana', role: 'ADMIN' });
  });

  it('falls back to the email local-part when username is missing', () => {
    // The displayName fallback chain (username → email local-part →
    // null) is the same one `resolveDisplayName` uses in
    // `session.ts`. resolveAdminUser reuses the same primitive so
    // the UserBlock shows the same text the public AuthSection
    // shows.
    const token = makeJwt({ sub: 'user-1', email: 'agente@casal.com', role: 'AGENT' });
    expect(resolveAdminUser(token)).toEqual({ displayName: 'agente', role: 'AGENT' });
  });

  it('returns displayName: null when neither username nor email is usable', () => {
    // A privileged user whose payload has no identity text is still
    // authorized (role is privileged) but has nothing to display.
    // The UserBlock renders the role badge only.
    const token = makeJwt({ sub: 'user-1', role: 'ADMINISTRATIVE' });
    expect(resolveAdminUser(token)).toEqual({ displayName: null, role: 'ADMINISTRATIVE' });
  });

  it('accepts every privileged role literal', () => {
    for (const role of ['ADMIN', 'AGENT', 'ADMINISTRATIVE'] as const) {
      const token = makeJwt({ username: 'user', role });
      expect(resolveAdminUser(token)).toEqual({ displayName: 'user', role });
    }
  });
});
