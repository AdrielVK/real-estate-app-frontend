/**
 * @deprecated Compatibility shim — the real home of these types is
 * `@/lib/business-users/types` (change `admin-property-business-users`,
 * design D1/D4).
 *
 * What was here: `fetchProfiles`, the mock-backed profile swap point
 * (REQ-101/S6). It is GONE: the RSC lift (REQ-PROP-002) fetches
 * `GET /business-user` server-side via `business-users/api.ts` and threads
 * the options as props, and a client-safe module can never delegate to the
 * server-only `authFetch` behind that fetcher (design D4).
 *
 * What remains: a TYPE-ONLY re-export so the existing
 * `import type { ProfileOption } from '@/lib/properties/profiles'` in
 * `ProfileCombobox`/`BasicInfoSection` keeps compiling. New code must
 * import the types from `@/lib/business-users/types` directly; this file
 * is deleted once those two imports are migrated (follow-up cleanup).
 */
export type { ProfileOption, ProfileType } from '@/lib/business-users/types';
