// @vitest-environment node
//
// `roles.ts` is a pure, framework-free module that pins the role
// whitelist. It is consumed by the proxy guard, the admin session
// resolver, and the login envelope schema. Run under Node so the
// function identity matches the production runtime.

import { describe, expect, it } from 'vitest';

import {
  isPrivilegedRole,
  PRIVILEGED_ROLES,
  type Role,
  USER_ROLES,
  type UserRole,
} from '@/lib/auth/roles';

describe('role constants', () => {
  it('USER_ROLES lists every role the backend may emit (privileged + CLIENT)', () => {
    // The schema validator at the login boundary is `z.enum(USER_ROLES)`,
    // so dropping a backend role from this list would silently break
    // every login. Pinned explicitly.
    expect(USER_ROLES).toEqual(['ADMIN', 'AGENT', 'ADMINISTRATIVE', 'CLIENT']);
  });

  it('PRIVILEGED_ROLES is the strict subset allowed past the admin guard', () => {
    // Spec "Role Whitelist Guard" — proxy MUST only allow ADMIN/AGENT/
    // ADMINISTRATIVE; CLIENT must be redirected to `/`.
    expect(PRIVILEGED_ROLES).toEqual(['ADMIN', 'AGENT', 'ADMINISTRATIVE']);
  });

  it('PRIVILEGED_ROLES is a strict subset of USER_ROLES (no drift)', () => {
    // If this ever fails, USER_ROLES and PRIVILEGED_ROLES drifted and
    // the proxy could allow a role the login schema rejects, or vice
    // versa. The design lock is: every privileged role is a user role.
    for (const role of PRIVILEGED_ROLES) {
      expect(USER_ROLES).toContain(role);
    }
    expect(PRIVILEGED_ROLES.length).toBeLessThan(USER_ROLES.length);
  });
});

describe('isPrivilegedRole predicate', () => {
  it('returns true for every value in PRIVILEGED_ROLES', () => {
    for (const role of PRIVILEGED_ROLES) {
      expect(isPrivilegedRole(role)).toBe(true);
    }
  });

  it('returns true when the value is a string literal of a privileged role (without USER_ROLES roundtrip)', () => {
    // The function MUST accept the raw JWT-claim shape: a string
    // that happens to match. No type cast on the caller side.
    expect(isPrivilegedRole('ADMIN')).toBe(true);
    expect(isPrivilegedRole('AGENT')).toBe(true);
    expect(isPrivilegedRole('ADMINISTRATIVE')).toBe(true);
  });

  it('returns false for CLIENT (the only non-privileged USER_ROLES value)', () => {
    // Spec "Non-privileged role" scenario: a CLIENT token hits /admin
    // and the proxy must redirect away.
    expect(isPrivilegedRole('CLIENT')).toBe(false);
  });

  it('returns false for unknown / future roles (fail-closed)', () => {
    // The backend might one day add a new role. A naive `string`-typed
    // predicate would let it in. We fail-closed: anything outside the
    // whitelist is denied.
    expect(isPrivilegedRole('VISITOR')).toBe(false);
    expect(isPrivilegedRole('SUPERUSER')).toBe(false);
    expect(isPrivilegedRole('admin')).toBe(false); // case-sensitive
    expect(isPrivilegedRole('Admin')).toBe(false);
  });

  it('returns false for non-string inputs (null, undefined, number, object, array)', () => {
    // The function MUST defend against every non-string runtime shape
    // the JWT payload could carry. The proxy reads from `payload.role`
    // which is `unknown` until narrowed.
    expect(isPrivilegedRole(null)).toBe(false);
    expect(isPrivilegedRole(undefined)).toBe(false);
    expect(isPrivilegedRole(42)).toBe(false);
    expect(isPrivilegedRole({ role: 'ADMIN' })).toBe(false);
    expect(isPrivilegedRole(['ADMIN'])).toBe(false);
    expect(isPrivilegedRole('')).toBe(false);
  });

  it('narrows the value to PrivilegedRole when it returns true (type guard)', () => {
    // The runtime anchor: the predicate must return true for a known
    // privileged string. The compile-time check is enforced by the
    // TypeScript compiler — if the predicate lost its `value is
    // PrivilegedRole` signature, every consumer (proxy, RSC) would
    // fail to compile. This test pins the runtime contract only.
    expect(isPrivilegedRole('AGENT' as string)).toBe(true);
  });
});

describe('type-level role unions', () => {
  it('Role accepts every privileged literal (compile-time enforced)', () => {
    // The compile-time proof: `Role` must accept each privileged
    // literal — otherwise every caller of the proxy guard fails to
    // compile. The runtime anchor is `isPrivilegedRole`, already
    // pinned above; here we just confirm the type accepts the
    // literal that the predicate returned true for.
    const accepted: Role[] = ['ADMIN', 'AGENT', 'ADMINISTRATIVE'];
    expect(isPrivilegedRole(accepted[0])).toBe(true);
    expect(accepted).toHaveLength(3);
  });

  it('UserRole accepts every privileged literal and CLIENT (compile-time enforced)', () => {
    // Same pattern as `Role`: the type assignment is the proof.
    // The runtime anchor is the discriminated list of all four
    // roles the backend may emit.
    const accepted: UserRole[] = ['ADMIN', 'AGENT', 'ADMINISTRATIVE', 'CLIENT'];
    expect(isPrivilegedRole(accepted[0])).toBe(true);
    expect(isPrivilegedRole(accepted[3])).toBe(false);
    expect(accepted).toHaveLength(4);
  });
});
