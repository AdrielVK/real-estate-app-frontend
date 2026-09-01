/**
 * `AddressSection` — section 2 (Dirección) of the create form.
 *
 * Thin re-export wrapper (AS-6/AS-7): the implementation now lives in
 * `src/components/property/AddressField.tsx` — the search-orchestrating
 * successor of this section (proxy-backed Places autocomplete + 11-key
 * hydration through the unchanged `onChange(FieldKey, string)`
 * contract). Keeping this module's public surface identical
 * (`AddressSection`, `AddressValues`, `AddressSectionProps`) means
 * `PropertyCreateForm` has ZERO diff: same import line, same props,
 * same stepper heuristic, same wire payload.
 *
 * Rollback boundary: revert this file to its prior internals and
 * delete `src/components/property/` — the form never notices.
 */

export type {
  AddressFieldProps as AddressSectionProps,
  AddressValues,
} from '@/components/property/AddressField';
export { AddressField as AddressSection } from '@/components/property/AddressField';
