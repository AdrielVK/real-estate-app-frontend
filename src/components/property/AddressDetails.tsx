'use client';

/**
 * `AddressDetails` — read-only summary of the confirmed place (AS-5),
 * now the presentational `<dl>` child of `AddressConfirmedSection`
 * (property-address-ui-refine, design D1).
 *
 * Shown only AFTER an autocomplete selection (hidden pre-selection):
 * it reflects the LIVE controlled values it receives, so manual edits
 * in the field grid update the summary immediately (ACS-2). The
 * footer is the short ACS-5 hint (property-address-clear-layout): the
 * exact string `Puedes editar los campos de la direccion` — the
 * disclosure it used to enumerate is gone and placeId/lat/lng belong
 * to the selection (ACS-4).
 *
 * Why a `<dl>` of text instead of disabled inputs:
 * - the form's a11y contract counts every labeled control; read-only
 *   text adds zero controls, so the grid's ids/labels stay unique and
 *   `PropertyCreateForm.test.tsx`'s control enumeration is unaffected.
 * - no `<fieldset>` either: the form test pins exactly four fieldsets.
 */
import { cn } from '@/lib/utils';

import type { AddressValues } from './AddressField';

export interface AddressDetailsProps {
  /** The prediction description the user committed. */
  description: string;
  /** The hydrated values the summary mirrors (read-only snapshot). */
  values: AddressValues;
  /**
   * DCS-5 (property-address-confirm-sync-v2): the core fields diverge
   * from the last confirmed selection — the text shown here no longer
   * matches the hidden lat/lng/placeId. Amber border + stale label
   * replace the neutral treatment; everything reverts when the flag
   * clears (re-selection or clear).
   */
  isStale?: boolean;
}

/** Label → value lines, in scan order; blank values are omitted. */
function summaryLines(values: AddressValues): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [
    { label: 'Dirección formateada', value: values.addressFormatted },
    { label: 'Ciudad', value: values.addressCity },
    { label: 'País', value: values.addressCountry },
    { label: 'Calle', value: values.addressStreet },
    { label: 'Número o altura de calle', value: values.addressStreetNumber },
    { label: 'Barrio', value: values.addressNeighborhood },
    { label: 'Provincia', value: values.addressState },
    { label: 'Código postal', value: values.addressPostalCode },
  ];
  return lines.filter((line) => line.value !== '');
}

export function AddressDetails({ description, values, isStale }: AddressDetailsProps) {
  return (
    <div
      className={cn(
        'glass-panel grid gap-2 rounded-lg border p-3',
        isStale ? 'border-amber-500/60' : 'border-border/70',
      )}
    >
      <p className="text-xs font-medium uppercase tracking-tight text-muted-foreground">
        {isStale ? 'Vista previa anterior' : 'Dirección confirmada'}
      </p>
      <p className="text-sm font-medium leading-snug">{description}</p>
      <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {summaryLines(values).map((line) => (
          <div key={line.label} className="flex min-w-0 items-baseline gap-1.5">
            <dt className="shrink-0 text-muted-foreground">{line.label}:</dt>
            <dd className="min-w-0 truncate">{line.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Puedes editar los campos de la direccion
      </p>
    </div>
  );
}
