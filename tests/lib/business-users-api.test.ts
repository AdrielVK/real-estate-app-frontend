/**
 * Unit suite for the business-user fetcher (`change: admin-property-business-users`).
 *
 * Pins REQ-BUA-001..005 at the highest available fidelity: `authFetch` is
 * mocked at the import boundary (design Testing Strategy — no e2e harness
 * exists for admin flows, so a mocked `authFetch` is the max-fidelity seam).
 *
 * Contracts proven here:
 * - `buildBusinessUsersQuery`: `page=1`/`limit=50` defaults, `role` omitted
 *   when undefined, `toNumber` coercion of string numerics (REQ-BUA-004).
 * - `fetchBusinessUsers`: 5 tolerant envelope shapes, AGENT→`agent` /
 *   else→`owner` mapping, tolerant skip of bad items (REQ-BUA-001/003),
 *   fail-open `[]` on non-2xx / malformed body / network throw
 *   (REQ-BUA-001), and `NEXT_REDIRECT` re-throw — never swallowed into
 *   `[]` (REQ-BUA-005).
 * - `BUSINESS_USER_ROLES`: the 5-value whitelist with local VISITOR drift
 *   (REQ-BUA-002).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authFetch } from '@/lib/auth/api';
import { buildBusinessUsersQuery, fetchBusinessUsers } from '@/lib/business-users/api';
import { BUSINESS_USER_ROLES, type UserRole } from '@/lib/business-users/types';

vi.mock('@/lib/auth/api', () => ({
  authFetch: vi.fn(),
}));

const authFetchMock = vi.mocked(authFetch);

/** Minimal `Response` stand-in — the fetcher only reads ok/status/json. */
function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.ok === false ? 'Error' : 'OK',
    json: async () => body,
  } as unknown as Response;
}

const AGENT = { id: '11111111-1111-4111-8111-111111111111', name: 'Mariano Díaz', role: 'AGENT' };
const CLIENT = { id: '22222222-2222-4222-8222-222222222222', name: 'Ana Pérez', role: 'CLIENT' };

beforeEach(() => {
  authFetchMock.mockReset();
});

/* -------------------------------------------------------------------------- */
/* buildBusinessUsersQuery (REQ-BUA-004)                                      */
/* -------------------------------------------------------------------------- */

describe('buildBusinessUsersQuery', () => {
  it('defaults page=1 and limit=50 and omits role when undefined', () => {
    expect(buildBusinessUsersQuery({})).toBe('?page=1&limit=50');
  });

  it('includes the role param before the pagination params', () => {
    expect(buildBusinessUsersQuery({ role: 'AGENT' })).toBe('?role=AGENT&page=1&limit=50');
  });

  it('keeps explicit page/limit values', () => {
    expect(buildBusinessUsersQuery({ page: 2, limit: 10 })).toBe('?page=2&limit=10');
  });

  it('coerces string numerics via toNumber (defensive DTO tolerance)', () => {
    expect(
      buildBusinessUsersQuery({
        page: '3' as unknown as number,
        limit: '25' as unknown as number,
      }),
    ).toBe('?page=3&limit=25');
  });

  it('falls back to the defaults on non-numeric page/limit', () => {
    expect(
      buildBusinessUsersQuery({
        page: 'abc' as unknown as number,
        limit: null as unknown as number,
      }),
    ).toBe('?page=1&limit=50');
  });
});

/* -------------------------------------------------------------------------- */
/* fetchBusinessUsers — happy path + envelopes (REQ-BUA-001/003/004)          */
/* -------------------------------------------------------------------------- */

describe('fetchBusinessUsers', () => {
  it('calls authFetch with GET /business-user and the built query', async () => {
    authFetchMock.mockResolvedValue(jsonResponse({ success: true, data: [] }));

    await fetchBusinessUsers({ role: 'AGENT' });

    expect(authFetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe('/business-user?role=AGENT&page=1&limit=50');
    expect(init).toEqual({ method: 'GET' });
  });

  it('applies page=1&limit=50 defaults when the caller omits them', async () => {
    authFetchMock.mockResolvedValue(jsonResponse([]));

    await fetchBusinessUsers({});

    expect(authFetchMock.mock.calls[0][0]).toBe('/business-user?page=1&limit=50');
  });

  // REQ-BUA-004: five known backend shapes must all parse.
  const envelopeShapes: [string, unknown][] = [
    ['{success, data[], meta}', { success: true, data: [AGENT, CLIENT], meta: { page: 1 } }],
    ['{success, data{items}}', { success: true, data: { items: [AGENT, CLIENT] } }],
    ['{success, data[]}', { success: true, data: [AGENT, CLIENT] }],
    ['{data[]}', { data: [AGENT, CLIENT] }],
    ['bare array', [AGENT, CLIENT]],
  ];
  it.each(envelopeShapes)('parses the %s envelope into ProfileOption[]', async (_label, body) => {
    authFetchMock.mockResolvedValue(jsonResponse(body));

    const result = await fetchBusinessUsers({ role: 'AGENT' });

    expect(result).toEqual([
      { id: AGENT.id, name: AGENT.name, type: 'agent' },
      { id: CLIENT.id, name: CLIENT.name, type: 'owner' },
    ]);
  });

  it('returns [] for an empty payload', async () => {
    authFetchMock.mockResolvedValue(jsonResponse({ success: true, data: [] }));

    await expect(fetchBusinessUsers({})).resolves.toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Mapping tolerance (REQ-BUA-002/003)                                        */
/* -------------------------------------------------------------------------- */

describe('mapBusinessUser (via fetchBusinessUsers)', () => {
  it('maps AGENT to type agent and every other role to owner', async () => {
    authFetchMock.mockResolvedValue(
      jsonResponse([
        { id: 'a1', name: 'A', role: 'AGENT' },
        { id: 'c1', name: 'C', role: 'CLIENT' },
        { id: 'ad1', name: 'AD', role: 'ADMIN' },
        { id: 'v1', name: 'V', role: 'VISITOR' },
        { id: 'x1', name: 'X', role: 'SOMETHING_ELSE' },
        { id: 'n1', name: 'N' },
      ]),
    );

    const result = await fetchBusinessUsers({});

    expect(result.map((option) => option.type)).toEqual([
      'agent',
      'owner',
      'owner',
      'owner',
      'owner',
      'owner',
    ]);
  });

  it('skips items with missing, empty, or non-string id/name — no throw (REQ-BUA-003)', async () => {
    authFetchMock.mockResolvedValue(
      jsonResponse([
        { name: 'No Id', role: 'AGENT' },
        { id: '', name: 'Empty Id', role: 'AGENT' },
        { id: 42, name: 'Numeric Id', role: 'AGENT' },
        { id: 'ok1', role: 'AGENT' },
        { id: 'ok2', name: '', role: 'AGENT' },
        { id: 'ok3', name: 7, role: 'AGENT' },
        'not-an-object',
        null,
        { id: 'good', name: 'Good', role: 'AGENT' },
      ]),
    );

    const result = await fetchBusinessUsers({});

    expect(result).toEqual([{ id: 'good', name: 'Good', type: 'agent' }]);
  });
});

describe('BUSINESS_USER_ROLES (REQ-BUA-002)', () => {
  it('is the 5-value whitelist with VISITOR normalized locally', () => {
    expect(BUSINESS_USER_ROLES).toEqual(['ADMIN', 'AGENT', 'ADMINISTRATIVE', 'CLIENT', 'VISITOR']);
  });

  it('widens the auth UserRole at the type level so VISITOR is a legal query role', () => {
    // Type-side pin: this compiles ONLY because the business-users
    // `UserRole` union admits `VISITOR` (the auth `UserRole` does not).
    const visitorRole: UserRole = 'VISITOR';
    expect(BUSINESS_USER_ROLES).toContain(visitorRole);
  });
});

/* -------------------------------------------------------------------------- */
/* Fail-open + redirect propagation (REQ-BUA-001/005)                         */
/* -------------------------------------------------------------------------- */

describe('fetchBusinessUsers failure contract', () => {
  it('fail-open [] on a non-2xx response', async () => {
    authFetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));

    await expect(fetchBusinessUsers({})).resolves.toEqual([]);
  });

  it('fail-open [] on a malformed envelope', async () => {
    authFetchMock.mockResolvedValue(jsonResponse({ unexpected: true }));

    await expect(fetchBusinessUsers({})).resolves.toEqual([]);
  });

  it('fail-open [] when the body is not an object at all', async () => {
    authFetchMock.mockResolvedValue(jsonResponse('boom'));

    await expect(fetchBusinessUsers({})).resolves.toEqual([]);
  });

  it('fail-open [] when authFetch rejects with a network error', async () => {
    authFetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(fetchBusinessUsers({})).resolves.toEqual([]);
  });

  // REQ-BUA-005: the terminal-401 redirect from authFetch must propagate to
  // the RSC — swallowing it would render an empty form instead of bouncing
  // to /login. Same digest shape as the properties-actions precedent.
  it('re-throws NEXT_REDIRECT instead of masking it as []', async () => {
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/login;307;',
    });
    authFetchMock.mockRejectedValue(redirectError);

    await expect(fetchBusinessUsers({})).rejects.toBe(redirectError);
  });
});
