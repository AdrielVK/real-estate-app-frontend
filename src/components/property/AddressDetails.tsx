'use client';

/**
 * `AddressDetails` — read-only summary of the confirmed place (AS-5).
 *
 * Shown only AFTER an autocomplete selection (hidden pre-selection):
 * it reflects what hydration mapped from the details response, plus a
 * manual-override note so ops users know every field below stays
 * editable — the search is an accelerator, never a lock-in.
 *
 * Why a `<dl>` of text instead of disabled inputs:
 * - the form's a11y contract counts every labeled control; read-only
 *   text adds zero controls, so the grid's ids/labels stay unique and
 *   `PropertyCreateForm.test.tsx`'s control enumeration is unaffected.
 * - no `<fieldset>` either: the form test pins exactly four fieldsets.
 */
import type { AddressValues } from './AddressField';

export interface AddressDetailsProps {
  /** The prediction description the user committed. */
  description: string;
  /** The hydrated values the summary mirrors (read-only snapshot). */
  values: AddressValues;
}

/** Label → value lines, in scan order; blank values are omitted. */
function summaryLines(values: AddressValues): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [
    { label: 'Dirección formateada', value: values.addressFormatted },
    { label: 'Ciudad', value: values.addressCity },
    { label: 'País', value: values.addressCountry },
    { label: 'Calle', value: values.addressStreet },
    { label: 'Número', value: values.addressStreetNumber },
    { label: 'Barrio', value: values.addressNeighborhood },
    { label: 'Provincia', value: values.addressState },
    { label: 'Código postal', value: values.addressPostalCode },
  ];
  return lines.filter((line) => line.value !== '');
}

export function AddressDetails({ description, values }: AddressDetailsProps) {
  return (
    <div className="glass-panel grid gap-2 rounded-lg border border-border/70 p-3">
      <p className="text-xs font-medium uppercase tracking-tight text-muted-foreground">
        Dirección confirmada
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
        Podés editar cualquier campo manualmente; la búsqueda solo completa los datos.
      </p>
    </div>
  );
}
