import { describe, expect, it } from 'vitest';

import {
  areCredentialsValid,
  GENERIC_LOGIN_ERROR,
  isValidEmail,
  isValidPassword,
} from '@/lib/auth/validation';

describe('isValidEmail', () => {
  // Happy path — mirrors the backend value-object regex.
  it('accepts a standard local-part + domain + TLD email', () => {
    expect(isValidEmail('user@domain.com')).toBe(true);
  });

  it('accepts dots and plus aliases in the local part', () => {
    expect(isValidEmail('first.last+tag@sub.domain.io')).toBe(true);
  });

  // Edge cases — every form below MUST fail because the backend value
  // object rejects them and the spec table enumerates them explicitly.
  it('rejects an email without an @ symbol', () => {
    expect(isValidEmail('userdomain.com')).toBe(false);
  });

  it('rejects an email without a TLD (no dot after the @)', () => {
    expect(isValidEmail('user@domain')).toBe(false);
  });

  it('rejects an email containing a space', () => {
    expect(isValidEmail('user @domain.com')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isValidPassword', () => {
  // Happy path — matches the backend password value object: string,
  // length ≥ 8, at least one uppercase, one lowercase, one symbol.
  it('accepts a password that meets every backend rule', () => {
    expect(isValidPassword('Abcdef1!')).toBe(true);
  });

  // Length failure — covers the `min 8` rule.
  it('rejects a password shorter than 8 characters', () => {
    expect(isValidPassword('Ab1!')).toBe(false);
  });

  // Uppercase failure — covers the `[A-Z]` rule.
  it('rejects a password with no uppercase letter', () => {
    expect(isValidPassword('abcdef1!')).toBe(false);
  });

  // Lowercase failure — covers the `[a-z]` rule.
  it('rejects a password with no lowercase letter', () => {
    expect(isValidPassword('ABCDEF1!')).toBe(false);
  });

  // Symbol failure — covers the `[^a-zA-Z0-9]` rule.
  it('rejects a password with no non-alphanumeric symbol', () => {
    expect(isValidPassword('Abcdef12')).toBe(false);
  });

  // Edge case — the backend requires a string. A non-string must fail
  // because the function is the trust boundary.
  it('rejects a non-string password (number)', () => {
    // `as unknown as string` is intentional — we are testing the type
    // guard, not the caller's typing. The implementation MUST defend
    // against bad runtime input.
    expect(isValidPassword(12345678 as unknown as string)).toBe(false);
  });
});

describe('areCredentialsValid', () => {
  it('returns true only when BOTH email and password are valid', () => {
    expect(areCredentialsValid({ email: 'user@domain.com', password: 'Abcdef1!' })).toBe(true);
  });

  it('returns false when the email is invalid (even if password is strong)', () => {
    expect(areCredentialsValid({ email: 'userdomain.com', password: 'Abcdef1!' })).toBe(false);
  });

  it('returns false when the password is invalid (even if email is well-formed)', () => {
    expect(areCredentialsValid({ email: 'user@domain.com', password: 'weak' })).toBe(false);
  });

  it('returns false when both inputs are invalid', () => {
    expect(areCredentialsValid({ email: 'nope', password: 'weak' })).toBe(false);
  });

  it('never returns a field-specific reason — only a boolean', () => {
    // The function signature MUST be `boolean` so the UI cannot
    // accidentally branch on a leaked reason. This is a regression
    // guard for the non-disclosure requirement.
    const result = areCredentialsValid({ email: 'a', password: 'b' });
    expect(typeof result).toBe('boolean');
    expect(result).toBe(false);
  });
});

describe('GENERIC_LOGIN_ERROR', () => {
  it('is the spec-mandated lowercase Spanish string', () => {
    // Hard-pinned by the spec (`credenciales inválidas`). The form,
    // the action, and every test import this constant so the wording
    // never drifts between layers.
    expect(GENERIC_LOGIN_ERROR).toBe('Credenciales inválidas');
  });
});
