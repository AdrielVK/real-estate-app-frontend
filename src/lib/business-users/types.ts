/**
 * Client-safe domain types for the business-user boundary
 * (`change: admin-property-business-users`, design D1/D2).
 *
 * Why a separate types module (design D1)?
 * - `business-users/api.ts` is server-only (it imports `authFetch`, which
 *   reads `next/headers` cookies and throws `NEXT_REDIRECT`). Client
 *   components still need the `ProfileOption` shape for props. Keeping the
 *   types here — free of any framework import — lets the client graph
 *   reference them without pulling `next/headers` into the bundle (same
 *   framework-free precedent as `lib/auth/roles.ts`).
 *
 * Why a LOCAL role list (design D2)?
 * - `auth/roles.ts` owns the login/proxy guard (`z.enum`, `isPrivilegedRole`).
 *   The backend's business-user roles include `VISITOR`, a value the auth
 *   boundary must never accept. Adding it there would ripple into auth
 *   policy, so the business-users domain normalizes the drift locally by
 *   deriving from `USER_ROLES` and appending `VISITOR` (REQ-BUA-002).
 */
import { USER_ROLES } from '@/lib/auth/roles';

/** Combobox profile kind — `agent` for AGENT users, `owner` for everything else. */
export type ProfileType = 'agent' | 'owner';

/** One selectable agent/owner profile. `id` is the backend user id. */
export interface ProfileOption {
  id: string;
  name: string;
  type: ProfileType;
}

/**
 * The full set of roles `GET /business-user` may filter or return:
 * the four auth-boundary roles plus the backend-only `VISITOR` (REQ-BUA-002).
 * Derived from `USER_ROLES` so the shared prefix cannot drift silently.
 */
export const BUSINESS_USER_ROLES = [...USER_ROLES, 'VISITOR'] as const;

/**
 * Role literal union used as the `role` query param. Derived from
 * `BUSINESS_USER_ROLES` so the runtime array and the type stay in lockstep.
 * Intentionally shadows the narrower `UserRole` from `auth/roles.ts` —
 * this domain admits `VISITOR`, the auth boundary must not.
 */
// Intentionally shadows the narrower auth `UserRole`; see the module header.
export type UserRole = (typeof BUSINESS_USER_ROLES)[number];

/** Query DTO for `GET /business-user` (backend `ListBusinessUsersQueryDto`). */
export interface ListBusinessUsersQueryDto {
  role?: UserRole;
  page?: number;
  limit?: number;
}

/**
 * A single business-user item BEFORE narrowing. Every field is `unknown`
 * until `mapBusinessUser` validates it — the tolerant-parse contract
 * (REQ-BUA-003/004): bad items are skipped, never thrown on.
 */
export interface BusinessUserRaw {
  id?: unknown;
  name?: unknown;
  role?: unknown;
}

/* -------------------------------------------------------------------------- */
/* Create business user (`change: create-business-users-modal`, BR1–BR5).     */
/* -------------------------------------------------------------------------- */

/**
 * Roles the create modal may submit. Narrower than `BUSINESS_USER_ROLES`
 * on purpose: the DTO admits no `CLIENT`/`VISITOR` (spec assumption 2 —
 * the owner combobox sends `ADMINISTRATIVE`).
 */
export const CREATE_BUSINESS_USER_ROLES = ['AGENT', 'ADMINISTRATIVE'] as const;

/** Role literal union accepted by the create schema and DTO. */
export type CreateBusinessUserRole = (typeof CREATE_BUSINESS_USER_ROLES)[number];

/** Whitelisted payload for `POST profiles/business-users` (BR2). */
export interface CreateBusinessUserDto {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: CreateBusinessUserRole;
}

/**
 * Whitelist-parsed create response (BR3). `passwordHash` is structurally
 * absent — the action parser only picks these keys, so a leak would be
 * a type error, not a runtime surprise.
 */
export interface BusinessUserPrimitives {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Form field keys — mirrors the DTO so error mappers stay in lockstep. */
export type BusinessUserFieldKey = keyof CreateBusinessUserDto;

/** `useActionState` state for `createBusinessUserAction` (BR4/BR5). */
export interface CreateBusinessUserActionState {
  fieldErrors: Partial<Record<BusinessUserFieldKey, string>>;
  formError: string | null;
  success: boolean;
  user?: BusinessUserPrimitives;
}

/**
 * Client-safe initial state for `useActionState(createBusinessUserAction)`.
 * Lives in `types.ts` (client-safe) instead of `actions.ts` (`'use server'`)
 * so the client bundle can import it without crossing the server boundary.
 * Re-exported from `actions.ts` for server-side callers.
 */
export const INITIAL_CREATE_BUSINESS_USER_STATE: CreateBusinessUserActionState = {
  fieldErrors: {},
  formError: null,
  success: false,
};

/**
 * Narrow a created user to the combobox option shape (PR1). `AGENT`
 * feeds the agent combobox; every other role feeds the owner one —
 * same mapping as `mapBusinessUser` in `./api.ts` so the injected
 * option matches what a refetch would return.
 */
export function toProfileOption(user: BusinessUserPrimitives): ProfileOption {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    type: user.role === 'AGENT' ? 'agent' : 'owner',
  };
}
