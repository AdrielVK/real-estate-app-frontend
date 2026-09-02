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
 * - the Mapbox GL pin renders inside the block, gated by
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

import { Button } from '@/components/ui/Button';

import { AddressDetails } from './AddressDetails';
import type { AddressValues } from './AddressField';

/**
 * AS-4 mount boundary (moved verbatim from `AddressField`): the Mapbox
 * GL module is client-only and heavy, so it loads through `next/dynamic`
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
  /**
   * DCS-5/ACS-6 (property-address-confirm-sync-v2): live core fields
   * diverge from the confirmed snapshot — the text here no longer
   * matches the hidden coords. Amber details card + map overlay chip.
   */
  isStale?: boolean;
  /**
   * DCS-6: stale AND the composed retry query is under MIN_CHARS — the
   * auto-trigger is silent, so an explicit "Buscar nuevamente" CTA
   * takes over.
   */
  showRetryCta?: boolean;
  /** CTA handler — the orchestrator focuses the search input (AS-6 id). */
  onRetry?: () => void;
}

export function AddressConfirmedSection({
  description,
  values,
  isStale,
  showRetryCta,
  onRetry,
}: AddressConfirmedSectionProps) {
  const coordinates = parseCoordinates(values.addressLatitude, values.addressLongitude);

  return (
    <div className="grid gap-2">
      <AddressDetails description={description} values={values} isStale={isStale} />
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
        <div className="relative">
          <AddressMap latitude={values.addressLatitude} longitude={values.addressLongitude} />
          {isStale ? (
            // ACS-6: the pin below still belongs to the OLD selection —
            // say it over the map itself, where the lie is visible.
            <span className="absolute left-2 top-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              Vista previa anterior
            </span>
          ) : null}
        </div>
      ) : null}
      {showRetryCta ? (
        // DCS-6: the auto-trigger needs ≥3 chars to speak — when the
        // compose is silent, the section offers the explicit retry.
        <div className="justify-self-start">
          <Button type="button" size="sm" onClick={onRetry}>
            Buscar nuevamente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
