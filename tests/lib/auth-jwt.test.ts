// @vitest-environment node
//
// `isAccessTokenExpired` decodes JWT payloads server-side (logout
// pre-refresh heuristic). Run under Node so `Buffer` matches the
// production runtime exactly.

import { describe, expect, it } from 'vitest';

import { decodeAccessTokenPayload, isAccessTokenExpired } from '@/lib/auth/jwt';

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function makeJwt(payload: unknown): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

function expInSeconds(offsetSeconds: number): number {
  return Math.floor(Date.now() / 1000) + offsetSeconds;
}

describe('isAccessTokenExpired', () => {
  it('returns false for a token whose exp is in the future', () => {
    const token = makeJwt({ sub: 'user-1', exp: expInSeconds(900) });

    expect(isAccessTokenExpired(token)).toBe(false);
  });

  it('returns true for a token whose exp is in the past', () => {
    const token = makeJwt({ sub: 'user-1', exp: expInSeconds(-60) });

    expect(isAccessTokenExpired(token)).toBe(true);
  });

  it('returns true for a token whose exp is the current second', () => {
    // `exp` is the second AT WHICH the token stops being valid — a token
    // expiring right now cannot be used for the logout pre-refresh check.
    const token = makeJwt({ sub: 'user-1', exp: expInSeconds(0) });

    expect(isAccessTokenExpired(token)).toBe(true);
  });

  it('returns true when the value is not a JWT at all', () => {
    expect(isAccessTokenExpired('not-a-jwt')).toBe(true);
  });

  it('returns true when the payload segment is not decodable JSON', () => {
    const token = `${base64url('header')}.${base64url('this is not json')}.sig`;

    expect(isAccessTokenExpired(token)).toBe(true);
  });

  it('returns true when the payload has no exp claim', () => {
    const token = makeJwt({ sub: 'user-1' });

    expect(isAccessTokenExpired(token)).toBe(true);
  });

  it('returns true when exp is not a number', () => {
    const token = makeJwt({ sub: 'user-1', exp: 'tomorrow' });

    expect(isAccessTokenExpired(token)).toBe(true);
  });
});

describe('decodeAccessTokenPayload', () => {
  it('returns the payload object for a well-formed JWT', () => {
    const token = makeJwt({ sub: 'user-1', email: 'ana@casal.com', exp: expInSeconds(900) });

    expect(decodeAccessTokenPayload(token)).toEqual({
      sub: 'user-1',
      email: 'ana@casal.com',
      exp: expInSeconds(900),
    });
  });

  it('preserves the full record shape (no field stripping) so display-name extractors can read username/email', () => {
    const token = makeJwt({
      sub: 'user-1',
      email: 'ana@casal.com',
      username: 'ana',
      role: 'CLIENT',
      iat: 1_700_000_000,
      exp: expInSeconds(900),
    });

    const payload = decodeAccessTokenPayload(token);
    expect(payload).toMatchObject({
      sub: 'user-1',
      email: 'ana@casal.com',
      username: 'ana',
      role: 'CLIENT',
    });
    expect(payload?.exp).toBe(expInSeconds(900));
  });

  it('returns null when the input is not a JWT at all', () => {
    expect(decodeAccessTokenPayload('not-a-jwt')).toBeNull();
  });

  it('returns null when the payload segment is not decodable base64url', () => {
    // base64url forbids '=' padding and uses -/_ instead of +/;
    // any char outside that alphabet makes Buffer.from throw.
    const token = `${base64url('header')}.!!not-base64-url!!.sig`;

    expect(decodeAccessTokenPayload(token)).toBeNull();
  });

  it('returns null when the payload segment is valid base64 but not JSON', () => {
    const token = `${base64url('header')}.${base64url('this is not json')}.sig`;

    expect(decodeAccessTokenPayload(token)).toBeNull();
  });

  it('returns null when the payload segment is JSON but not an object (string, number, array)', () => {
    const stringPayload = `${base64url('header')}.${base64url(JSON.stringify('hello'))}.sig`;
    const numberPayload = `${base64url('header')}.${base64url(JSON.stringify(42))}.sig`;
    const arrayPayload = `${base64url('header')}.${base64url(JSON.stringify([1, 2, 3]))}.sig`;

    expect(decodeAccessTokenPayload(stringPayload)).toBeNull();
    expect(decodeAccessTokenPayload(numberPayload)).toBeNull();
    expect(decodeAccessTokenPayload(arrayPayload)).toBeNull();
  });

  it('returns null on an empty string', () => {
    expect(decodeAccessTokenPayload('')).toBeNull();
  });

  it('decodes unicode payloads byte-for-byte identically to the legacy Buffer-based implementation (edge parity)', () => {
    // The decoder is shared by the proxy (edge runtime) and the
    // server actions (Node runtime). The refactor from
    // `Buffer.from(..., 'base64url').toString('utf8')` to
    // `atob` + `TextDecoder` MUST preserve byte-for-byte parity
    // for every code point a real JWT may carry: ASCII, Latin-1
    // extensions, multi-byte UTF-8 (Spanish ñ/í, emoji, CJK).
    // This test pins the parity by hand-encoding the same string
    // with the legacy `Buffer` path and asserting the result is
    // identical. If the refactor ever changes the byte handling
    // (e.g. lossy `decodeURIComponent` escape round-trip), the
    // assert fails and the regression is caught before it ships.
    const fixtures: readonly { name: string; value: string }[] = [
      { name: 'ASCII', value: 'ana@casal.com' },
      { name: 'Spanish acute (admin-dashboard locale)', value: 'José María — ñoño' },
      { name: 'Spanish with diacritics', value: 'Ángela Piñeiro Ávila' },
      { name: 'multi-byte UTF-8 (Japanese)', value: 'ユーザー名' },
      { name: 'multi-byte UTF-8 (emoji)', value: 'user🛡️admin' },
      { name: 'surrogate pair (astral plane)', value: '𝕊𝕥𝕒𝕗𝕗' },
      { name: 'JSON delimiters and escapes', value: '{"a":"b\\nc"}' },
      { name: 'overlong null bytes (must NOT be silently dropped)', value: 'a\u0000\u0000b' },
    ];

    for (const { name, value } of fixtures) {
      // The JWT round-trip: encode the JSON object `{value: ...}` with
      // the legacy Buffer path (utf8 bytes → base64url), then decode
      // with the production decoder. The decoder's contract is "JSON
      // object payload", so the encoded string is the JSON of the
      // object, not the raw value.
      const payloadObject = { value };
      const json = JSON.stringify(payloadObject);
      const encoded = Buffer.from(json, 'utf8').toString('base64url');
      const token = `${base64url('header')}.${encoded}.sig`;

      const decoded = decodeAccessTokenPayload(token);
      expect(decoded, name).not.toBeNull();
      // Byte-for-byte parity: the value must round-trip exactly.
      expect(decoded, name).toEqual(payloadObject);
    }
  });
});
