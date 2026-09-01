/**
 * Mock profile fixtures for the admin property-create form's profile
 * comboboxes (REQ-101, S6).
 *
 * The backend agent/owner endpoints do not exist yet, so the create
 * form runs on these literals. Two hard constraints the tests pin:
 * - `id` values are literal UUIDv4 strings — the Zod `z.uuid()` gate
 *   on `agentProfileId`/`ownerProfileId` must accept them untouched.
 * - Names are chosen so the S4 filter scenario ("mar") matches exactly
 *   two agents and one owner.
 */

import type { ProfileOption } from './profiles';

/** Mock agents — searchable via "mar" (María, Marcos). */
export const MOCK_AGENTS: ProfileOption[] = [
  { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', name: 'María Gómez', type: 'agent' },
  { id: '9c0b8a52-7d4e-4f6a-8b1c-2d3e4f5a6b7c', name: 'Marcos Díaz', type: 'agent' },
  { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', name: 'Lucía Torres', type: 'agent' },
  { id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', name: 'Julián Pita', type: 'agent' },
];

/** Mock property owners — "mar" matches Martha only. */
export const MOCK_OWNERS: ProfileOption[] = [
  { id: 'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f', name: 'Martha Ledezma', type: 'owner' },
  { id: 'd4e5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f80', name: 'Pedro Salinas', type: 'owner' },
  { id: 'e5f6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8091', name: 'Clara Núñez', type: 'owner' },
];
