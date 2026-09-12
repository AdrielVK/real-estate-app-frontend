/**
 * Zod schema for the create-business-user modal
 * (`change: create-business-users-modal`, BR1).
 *
 * Why a domain-local schema (not `lib/validation/`)?
 * - `lib/business-users/` already owns the DTO, the response
 *   whitelist and the server action. Keeping the schema next to them
 *   makes the boundary one import graph — the same source of truth
 *   runs the client submit gate and the server re-validation (trust
 *   boundary: the client gate is UX only).
 *
 * Why `refine(isValidEmail/isValidPassword)` instead of inline rules?
 * - The predicates already mirror the backend value objects
 *   (`UserEmailValueObject`, `PlainPasswordValueObject`: min 8,
 *   upper + lower + symbol). Reusing them kills password-policy
 *   drift between login and creation (design decision).
 *
 * Why submit-only (no debounce)?
 * - Five fields, one submit. Per-keystroke re-validation would fight
 *   the server `fieldErrors` the action returns — the modal renders
 *   client errors only after a submit attempt.
 */

import { z } from 'zod';

import { isValidEmail, isValidPassword } from '@/lib/auth/validation';

import { CREATE_BUSINESS_USER_ROLES } from './types';

const NAME_MAX_LENGTH = 100;

export const createBusinessUserSchema = z.object({
  email: z.string().trim().refine(isValidEmail, { message: 'Email inválido' }),
  firstName: z
    .string()
    .trim()
    .min(1, 'El nombre es requerido')
    .max(NAME_MAX_LENGTH, `El nombre no puede superar los ${NAME_MAX_LENGTH} caracteres`),
  lastName: z
    .string()
    .trim()
    .min(1, 'El apellido es requerido')
    .max(NAME_MAX_LENGTH, `El apellido no puede superar los ${NAME_MAX_LENGTH} caracteres`),
  password: z.string().refine(isValidPassword, {
    message: 'La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula y símbolo',
  }),
  role: z.enum(CREATE_BUSINESS_USER_ROLES, { message: 'Rol inválido' }),
});

export type CreateBusinessUserInput = z.infer<typeof createBusinessUserSchema>;
