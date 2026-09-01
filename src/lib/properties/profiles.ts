/**
 * Profile data access for the admin property-create form (REQ-101).
 *
 * `fetchProfiles` is the single swap point: when the backend exposes the
 * agent/owner endpoints, ONLY this function changes (mock return →
 * `authFetch`). The async contract means zero call-site churn — the
 * components already await it.
 *
 * S6 pins the current reality: data resolves from mocks and NO network
 * request is made (asserted with a `fetch` spy in
 * `tests/lib/properties-profiles.test.ts`).
 */

import { MOCK_AGENTS, MOCK_OWNERS } from './mock-profiles';

export type ProfileType = 'agent' | 'owner';

/** One selectable agent/owner profile. `id` is a UUIDv4 accepted by Zod. */
export interface ProfileOption {
  id: string;
  name: string;
  type: ProfileType;
}

/**
 * Resolve the available profiles for a type. Mock-backed until the
 * backend endpoints exist (out of scope for this change).
 */
export async function fetchProfiles(type: ProfileType): Promise<ProfileOption[]> {
  return type === 'agent' ? [...MOCK_AGENTS] : [...MOCK_OWNERS];
}
