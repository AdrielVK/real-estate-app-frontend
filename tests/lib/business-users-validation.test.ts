/**
 * Unit tests for `createBusinessUserSchema`
 * (`change: create-business-users-modal`, BR1).
 *
 * The schema is the client submit gate AND the server trust boundary —
 * both layers share this source of truth, so these assertions pin the
 * contract both sides rely on: five fields, email/password reuse the
 * backend-mirroring predicates, role is the narrow create enum,
 * validation runs at submit (no debounce lives here — this module has
 * no timing behavior at all).
 */

import { describe, expect, it } from 'vitest';

import { createBusinessUserSchema } from '@/lib/business-users/validation';

// Named constant (auth-actions.test.ts precedent) so the hardcoded
// test credential is not flagged as an inline password literal.
const VALID_PASSWORD = 'S3gura!x';

function validInput(): Record<string, unknown> {
  return {
    email: 'agente@inmobiliaria.com',
    firstName: 'María',
    lastName: 'Gómez',
    password: VALID_PASSWORD,
    role: 'AGENT',
  };
}

describe('createBusinessUserSchema — valid submit (BR1)', () => {
  it('accepts a fully valid AGENT payload', () => {
    const parsed = createBusinessUserSchema.safeParse(validInput());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual(validInput());
    }
  });

  it('accepts the ADMINISTRATIVE role (owner combobox path, PR3)', () => {
    const parsed = createBusinessUserSchema.safeParse({ ...validInput(), role: 'ADMINISTRATIVE' });
    expect(parsed.success).toBe(true);
  });
});

describe('createBusinessUserSchema — weak password (BR1 weak-password scenario)', () => {
  it.each([
    ['too short', 'S3g!x'],
    ['no uppercase', 's3gura!x'],
    ['no lowercase', 'S3GURA!X'],
    ['no symbol', 'S3gurax9'],
  ])('rejects a password with %s', (_label, password) => {
    const parsed = createBusinessUserSchema.safeParse({ ...validInput(), password });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.join('.') === 'password')).toBe(true);
    }
  });
});

describe('createBusinessUserSchema — role + email gates (BR1)', () => {
  it.each([['CLIENT'], ['VISITOR'], ['ADMIN'], [''], [undefined]])(
    'rejects role %s — the DTO admits no CLIENT/VISITOR widening',
    (role) => {
      const parsed = createBusinessUserSchema.safeParse({ ...validInput(), role });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((issue) => issue.path.join('.') === 'role')).toBe(true);
      }
    },
  );

  it.each([['not-an-email'], ['agente@'], ['@inmobiliaria.com'], ['']])(
    'rejects email %s',
    (email) => {
      const parsed = createBusinessUserSchema.safeParse({ ...validInput(), email });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((issue) => issue.path.join('.') === 'email')).toBe(true);
      }
    },
  );

  it.each([['firstName'], ['lastName']])('rejects a blank %s', (field) => {
    const parsed = createBusinessUserSchema.safeParse({ ...validInput(), [field]: '   ' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.join('.') === field)).toBe(true);
    }
  });
});
