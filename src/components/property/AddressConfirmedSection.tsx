'use client';

/**
 * `AddressConfirmedSection` — the single owner of the confirmed address
 * view (capability `address-confirmed-section`, ACS-1..ACS-4; the AS-5/
 * AS-6 delegation target from `AddressField`).
 *
 * Composition (design D1):
 * - `AddressDetails` stays the presentational `<dl>` child (zero labeled
 *   controls, glass-panel card kept per D5);
 * - the system trio (`addressPlaceId`/`addressLatitude`/
 *   `addressLongitude`) ships as `type=hidden` `readOnly` inputs (D3):
 *   `buildPayload` reads state so the values ride regardless, and the
 *   ids keep the error-summary anchors `#addressPlaceId/
 *   #addressLatitude/#addressLongitude` alive;
 * - the Leaflet pin renders inside the block, gated by
 *   `parseCoordinates` over the LIVE values (ACS-3) — the
 *   `dynamic(ssr:false)` const moved here from `AddressField` (AS-4
 *   boundary unchanged: the chunk is never requested without real
 *   coordinates).
 *
 * Why it receives LIVE controlled `values` and not the hydration
 * snapshot (design D2, ACS-2): a manual edit in the disclosure grid must
 * update the summary immediately — the form state is the single display
 * source. Only the `description` is frozen: the prediction text is not
 * editable anywhere, so it stays in the parent's `confirmed` state.
 *
 * The section renders ONLY while a selection is confirmed (ACS-1) —
 * that gate is the orchestrator's; nothing here mounts pre-selection.
 */
import dynamic from 'next/dynamic';

import { parseCoordinates } from '@/lib/geocoding/coordinates';

import { AddressDetails } from './AddressDetails';
import type { AddressValues } from './AddressField';

/**
 * AS-4 mount boundary (moved verbatim from `AddressField`): Leaflet is
 * client-only and heavy, so the map module loads through `next/dynamic`
 * with `ssr:false` — and only when the controlled lat/lng pass
 * `parseCoordinates` (the render below is gated, so the chunk is never
 * even requested without real coordinates).
 */
const AddressMap = dynamic(() => import('./AddressMap'), { ssr: false });

/** System keys demoted from editable Fields to hidden inputs (AS-12). */
const SYSTEM_FIELD_KEYS = ['addressPlaceId', 'addressLatitude', 'addressLongitude'] as const;

export interface AddressConfirmedSectionProps {
  /** Frozen prediction description committed at selection. */
  description: string;
  /** LIVE controlled values — display + hidden-input source (ACS-2/4). */
  values: AddressValues;
}

export function AddressConfirmedSection({ description, values }: AddressConfirmedSectionProps) {
  const coordinates = parseCoordinates(values.addressLatitude, values.addressLongitude);

  return (
    <div className="grid gap-2">
      <AddressDetails description={description} values={values} />
      {/*
       * ACS-4/D3: hidden carriers for the system trio. `readOnly`
       * silences React's controlled-value warning; no `<label>` is ever
       * rendered for them, so no label/role query can reach an editable
       * control (AS-12). The ids preserve the error-summary anchors.
       */}
      {SYSTEM_FIELD_KEYS.map((key) => (
        <input key={key} type="hidden" id={key} name={key} readOnly value={values[key]} />
      ))}
      {coordinates ? (
        <AddressMap latitude={values.addressLatitude} longitude={values.addressLongitude} />
      ) : null}
    </div>
  );
}
