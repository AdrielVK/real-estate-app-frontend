'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import { Minus, Plus, X } from 'lucide-react';

import type { OperationSlug, SearchFilters, TagCategory } from '@/types/publication';
import { PROPERTY_AGE_OPTIONS, TAGS_BY_CATEGORY } from '@/lib/search/url';
import { cn } from '@/lib/utils';
import {
  AREA_MIN_MAX_ERROR_MESSAGE,
  minMaxError,
  sanitizeDigits,
} from '@/lib/validation/digits';

import { TagCombobox, type TagComboboxOption } from '@/components/public/TagCombobox';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

const CATEGORY_LABELS: Record<TagCategory, string> = {
  servicio: 'Servicios',
  amenidades: 'Amenidades',
  condicion: 'Condición',
  material: 'Materiales',
};

const CATEGORY_ORDER: readonly TagCategory[] = ['servicio', 'amenidades', 'condicion', 'material'];

const EXPENSES_CURRENCY_OPTIONS = [
  { value: 'ARS' as const, label: 'ARS' },
  { value: 'USD' as const, label: 'USD' },
];

export interface SearchResultsAdvancedFiltersProps {
  /** Whether the modal is open (controlled by the FilterBar). */
  open: boolean;
  /** Called when the modal wants to close (Cancelar, Escape, backdrop). */
  onOpenChange: (open: boolean) => void;
  /**
   * Current filter values, used to seed the local copy when the
   * modal opens. The modal is fully controlled — it never mutates
   * the parent's filter object directly.
   */
  value: SearchFilters;
  /**
   * Called when the user clicks "Aplicar". Receives the local copy
   * (Partial<SearchFilters> because callers may merge with their
   * own draft). The FilterBar is responsible for merging and then
   * committing to the URL via router.push.
   */
  onApply: (patch: SearchFilters) => void;
}

/**
 * `SearchResultsAdvancedFilters` — controlled modal that lets the
 * user edit the long tail of filter values (rooms/bedrooms/
 * bathrooms/garages min, area min/max, required tags per category,
 * antigüedad, expenses max + currency, "sin expensas" toggle, four
 * boolean toggles).
 *
 * Design decisions:
 * - **Controlled.** The bar owns the canonical `SearchFilters`; the
 *   modal works on a local copy seeded from the prop on open.
 *   `Aplicar` calls `onApply(localCopy)` and the bar merges.
 *   This keeps the URL the single source of truth.
 * - **Mobile bottom sheet.** The same `<Dialog>` is reused but the
 *   `className` adds `max-sm:mb-0 max-sm:mt-auto max-sm:w-full
 *   max-sm:max-w-none max-sm:rounded-b-none max-h-[90dvh]
 *   overflow-y-auto` to make it occupy the bottom of the viewport.
 *   The inline `m-auto` on the dialog itself can be overridden
 *   because we moved it to a class in the Dialog refactor.
 * - **Required tags by category.** The four `TagCombobox`es (one
 *   per `TagCategory`) flatten their slugs into a single
 *   `requiredTags` array. They run in `free-text` mode so users can
 *   type any word; suggestions from the hardcoded table are
 *   convenience only. We split on `Aplicar`, not on every keystroke,
 *   to avoid losing the per-category grouping while editing.
 * - **Antigüedad.** `propertyAge` — the age of the building, not the
 *   listing. The URL contract is in place; the backend filter is
 *   deferred until the search DTO grows the field.
 * - **Expensas.** `expensesMax` + `expensesCurrency` go together.
 *   The "Sin expensas" toggle flips the URL to `noExpensas=true`
 *   and clears the numeric cap so the wire stays clean.
 */
export function SearchResultsAdvancedFilters({
  open,
  onOpenChange,
  value,
  onApply,
}: SearchResultsAdvancedFiltersProps) {
  const headingId = useId();
  const [local, setLocal] = useState<SearchFilters>(value);

  // Re-seed the local copy every time the modal opens. Resetting
  // form state on open is the intentional AiSearchDialog pattern.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local copy from URL on open
      setLocal(value);
    }
  }, [open, value]);

  // ── Tag helpers (category → flat requiredTags) ──────────────────────
  function tagsForCategory(category: TagCategory): string[] {
    return local.requiredTags.filter((slug) =>
      TAGS_BY_CATEGORY[category].some((o) => o.slug === slug),
    );
  }

  function setCategoryTags(category: TagCategory, next: string[]) {
    const others = local.requiredTags.filter(
      (slug) => !TAGS_BY_CATEGORY[category].some((o) => o.slug === slug),
    );
    setLocal((prev) => ({ ...prev, requiredTags: [...others, ...next] }));
  }

  // ── Field helpers ───────────────────────────────────────────────────
  function setNumeric(key: keyof SearchFilters, raw: string) {
    if (raw === '') {
      setLocal((prev) => ({ ...prev, [key]: undefined }));
      return;
    }
    const n = Number.parseInt(raw, 10);
    setLocal((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : undefined }));
  }

  /**
   * Stepper setter: a stepper value of `0` is meaningless for the
   * min-counter (rooms, bedrooms, ...) and the URL would carry a
   * redundant `0` if we serialized it. We collapse 0 to undefined so
   * the on-the-wire form omits the parameter and the UI shows the
   * em-dash placeholder. Larger values pass through unchanged.
   */
  function setStepper(key: keyof SearchFilters, raw: string) {
    if (raw === '') {
      setLocal((prev) => ({ ...prev, [key]: undefined }));
      return;
    }
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setLocal((prev) => ({ ...prev, [key]: undefined }));
      return;
    }
    setLocal((prev) => ({ ...prev, [key]: n }));
  }

  function setToggle(key: 'acceptsCredits' | 'acceptsPets' | 'featuredOnly' | 'requiresGuarantor') {
    setLocal((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setAntiguedad(value: import('@/types/publication').PropertyAge | undefined) {
    setLocal((prev) => ({ ...prev, propertyAge: value }));
  }

  function setExpensesMax(value: number | undefined) {
    setLocal((prev) => ({ ...prev, expensesMax: value, expensesCurrency: prev.expensesCurrency ?? 'ARS' }));
  }

  function setExpensesCurrency(value: import('@/types/publication').Currency) {
    setLocal((prev) => ({ ...prev, expensesCurrency: value }));
  }

  function setNoExpensas(value: boolean) {
    setLocal((prev) => {
      if (value) {
        // Toggling "Sin expensas" wipes the numeric cap and its currency.
        const { expensesMax: _max, expensesCurrency: _cur, ...rest } = prev;
        void _max;
        void _cur;
        return { ...rest, noExpensas: true };
      }
      return { ...prev, noExpensas: undefined };
    });
  }

  function apply() {
    onApply(local);
    onOpenChange(false);
  }

  /**
   * Validation summary for the modal's footer. Aplicar filtros is
   * blocked while any of the checks fail so the URL never carries an
   * impossible filter combination (e.g. areaMin > areaMax).
   */
  const areaError = useMemo(
    () => ({
      total: minMaxError(
        local.totalAreaMin === undefined ? '' : String(local.totalAreaMin),
        local.totalAreaMax === undefined ? '' : String(local.totalAreaMax),
        AREA_MIN_MAX_ERROR_MESSAGE,
      ),
      covered: minMaxError(
        local.coveredAreaMin === undefined ? '' : String(local.coveredAreaMin),
        local.coveredAreaMax === undefined ? '' : String(local.coveredAreaMax),
        AREA_MIN_MAX_ERROR_MESSAGE,
      ),
    }),
    [local.totalAreaMin, local.totalAreaMax, local.coveredAreaMin, local.coveredAreaMax],
  );
  const hasValidationError = areaError.total !== null || areaError.covered !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      labelledBy={headingId}
      className="max-w-2xl p-0 max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-3xl"
    >
      <div className="flex max-h-[90dvh] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border/70 p-5">
          <h2 id={headingId} className="text-lg font-semibold text-foreground">
            Filtros completos
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar filtros"
            className="grid size-9 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* Counts */}
          <Section title="Cantidades mínimas">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberStepper
                label="Ambientes"
                value={local.roomsMin}
                onChange={(v) => setStepper('roomsMin', v)}
                testId="adv-rooms"
              />
              <NumberStepper
                label="Dormitorios"
                value={local.bedroomsMin}
                onChange={(v) => setStepper('bedroomsMin', v)}
                testId="adv-bedrooms"
              />
              <NumberStepper
                label="Baños"
                value={local.bathroomsMin}
                onChange={(v) => setStepper('bathroomsMin', v)}
                testId="adv-bathrooms"
              />
              <NumberStepper
                label="Cocheras"
                value={local.garagesMin}
                onChange={(v) => setStepper('garagesMin', v)}
                testId="adv-garages"
              />
            </div>
          </Section>

          {/* Surface area */}
          <Section title="Superficie (m²)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RangeInput
                label="Total mínima"
                value={local.totalAreaMin}
                onChange={(v) => setNumeric('totalAreaMin', v)}
                error={areaError.total}
                testId="adv-total-area-min"
              />
              <RangeInput
                label="Total máxima"
                value={local.totalAreaMax}
                onChange={(v) => setNumeric('totalAreaMax', v)}
                error={areaError.total}
                testId="adv-total-area-max"
              />
              <RangeInput
                label="Cubierta mínima"
                value={local.coveredAreaMin}
                onChange={(v) => setNumeric('coveredAreaMin', v)}
                error={areaError.covered}
                testId="adv-covered-area-min"
              />
              <RangeInput
                label="Cubierta máxima"
                value={local.coveredAreaMax}
                onChange={(v) => setNumeric('coveredAreaMax', v)}
                error={areaError.covered}
                testId="adv-covered-area-max"
              />
            </div>
            {areaError.total ? (
              <p
                className="text-xs text-red-500"
                role="alert"
                data-testid="adv-total-area-error"
              >
                {areaError.total}
              </p>
            ) : null}
            {areaError.covered ? (
              <p
                className="text-xs text-red-500"
                role="alert"
                data-testid="adv-covered-area-error"
              >
                {areaError.covered}
              </p>
            ) : null}
          </Section>

          {/* Tags per category — free-text mode so the user can type
              any word. Suggestions are convenience only. */}
          {CATEGORY_ORDER.map((category) => (
            <Section key={category} title={CATEGORY_LABELS[category]}>
              <TagCombobox
                label={CATEGORY_LABELS[category]}
                icon={<span aria-hidden>+</span>}
                options={TAGS_BY_CATEGORY[category]}
                value={tagsForCategory(category)}
                onChange={(next) => setCategoryTags(category, next)}
                mode="free-text"
                maxTags={5}
                placeholder={`Agregar ${CATEGORY_LABELS[category].toLowerCase()}`}
              />
            </Section>
          ))}

          {/* Antigüedad — age of the building, not the listing. */}
          <Section title="Antigüedad de la propiedad">
            <div className="flex flex-wrap gap-2" data-testid="adv-antiguedad">
              <RadioChip
                label="Cualquiera"
                selected={local.propertyAge === undefined}
                onClick={() => setAntiguedad(undefined)}
                testId="adv-antiguedad-any"
              />
              {PROPERTY_AGE_OPTIONS.map((opt) => (
                <RadioChip
                  key={opt.value}
                  label={opt.label}
                  selected={local.propertyAge === opt.value}
                  onClick={() => setAntiguedad(opt.value)}
                  testId={`adv-antiguedad-${opt.value}`}
                />
              ))}
            </div>
          </Section>

          {/* Expensas — numeric cap + currency + "sin expensas" toggle.
              When the toggle is on, the max/currency controls are
              grayed out and the URL only carries `noExpensas=true`. */}
          <Section title="Expensas">
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm" data-testid="adv-no-expensas">
                <input
                  type="checkbox"
                  checked={local.noExpensas === true}
                  onChange={(e) => setNoExpensas(e.target.checked)}
                  className="size-4 cursor-pointer accent-primary"
                />
                <span>Sin expensas</span>
              </label>
              <div
                className={cn(
                  'flex flex-col gap-2 rounded-2xl border border-border/70 p-3 transition-opacity sm:flex-row sm:items-end',
                  local.noExpensas === true && 'pointer-events-none opacity-50',
                )}
                data-testid="adv-expenses"
                aria-disabled={local.noExpensas === true}
              >
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Expensas máximas</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={local.expensesMax === undefined ? '' : String(local.expensesMax)}
                    onChange={(e) => {
                      const cleaned = sanitizeDigits(e.target.value);
                      if (cleaned === '') {
                        setExpensesMax(undefined);
                      } else {
                        setExpensesMax(Number.parseInt(cleaned, 10));
                      }
                    }}
                    disabled={local.noExpensas === true}
                    data-testid="adv-expenses-max"
                    className="h-10 rounded-full border border-border bg-background/70 px-4 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed"
                    placeholder="0"
                  />
                </label>
                <div
                  className="flex h-10 items-center gap-1.5"
                  data-testid="adv-expenses-currency"
                  role="radiogroup"
                  aria-label="Moneda de expensas"
                >
                  {EXPENSES_CURRENCY_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={local.expensesCurrency === c.value}
                      onClick={() => setExpensesCurrency(c.value)}
                      disabled={local.noExpensas === true}
                      data-testid={`adv-expenses-${c.value}`}
                      className={cn(
                        'h-8 cursor-pointer rounded-full border px-3 text-xs font-medium transition-all duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed',
                        local.expensesCurrency === c.value
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card/60 text-muted-foreground hover:border-primary/40',
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Toggles */}
          <Section title="Otros">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Toggle
                label="Acepta crédito"
                checked={local.acceptsCredits === true}
                onChange={() => setToggle('acceptsCredits')}
                testId="adv-toggle-credits"
              />
              <Toggle
                label="Acepta mascotas"
                checked={local.acceptsPets === true}
                onChange={() => setToggle('acceptsPets')}
                testId="adv-toggle-pets"
              />
              <Toggle
                label="Solo destacadas"
                checked={local.featuredOnly === true}
                onChange={() => setToggle('featuredOnly')}
                testId="adv-toggle-featured"
              />
              <Toggle
                label="Requiere garantía"
                checked={local.requiresGuarantor === true}
                onChange={() => setToggle('requiresGuarantor')}
                testId="adv-toggle-guarantor"
                hint="Filtro visible — el backend aún no lo aplica, se omite del request."
              />
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border/70 p-5 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => onOpenChange(false)}
            className="rounded-full"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={apply}
            disabled={hasValidationError}
            className="rounded-full"
            data-testid="adv-apply"
          >
            Aplicar filtros
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Local UI primitives                                                */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

interface NumberStepperProps {
  label: string;
  value: number | undefined;
  onChange: (next: string) => void;
  testId: string;
}

function NumberStepper({ label, value, onChange, testId }: NumberStepperProps) {
  // Display convention:
  // - `undefined` (no filter) → em-dash '—'
  // - `0` is treated as a transient value the user can never
  //   actually set: pressing - from '1' drops back to undefined
  //   instead of stepping through '0'. This keeps the URL clean
  //   (the parameter is omitted, not emitted as 0).
  const isAtMin = value === undefined || value <= 1;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div
        className="flex items-center justify-between rounded-full border border-border bg-background/70 px-1"
        data-testid={testId}
      >
        <button
          type="button"
          aria-label={`Restar ${label.toLowerCase()}`}
          onClick={() => {
            if (value === undefined) return;
            if (value <= 1) {
              // 1 → 0 short-circuits to undefined, displayed as '—'.
              onChange('');
            } else {
              onChange(String(value - 1));
            }
          }}
          disabled={isAtMin}
          className="grid size-8 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Minus aria-hidden className="size-3.5" />
        </button>
        <span
          className="text-sm font-medium tabular-nums"
          data-testid={`${testId}-value`}
        >
          {value === undefined ? '—' : value}
        </span>
        <button
          type="button"
          aria-label={`Sumar ${label.toLowerCase()}`}
          onClick={() => onChange(value === undefined ? '1' : String(value + 1))}
          className="grid size-8 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Plus aria-hidden className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

interface RangeInputProps {
  label: string;
  value: number | undefined;
  onChange: (next: string) => void;
  /** Validation error to show on the input (red border + aria-invalid). */
  error?: string | null;
  testId: string;
}

function RangeInput({ label, value, onChange, error, testId }: RangeInputProps) {
  const hasError = error !== null && error !== undefined;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value === undefined ? '' : String(value)}
        onChange={(e) => onChange(sanitizeDigits(e.target.value))}
        aria-invalid={hasError}
        data-testid={testId}
        className={cn(
          'h-10 rounded-full border border-border bg-background/70 px-4 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          hasError && 'border-red-500',
        )}
      />
    </label>
  );
}

interface RadioChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  testId: string;
}

function RadioChip({ label, selected, onClick, testId }: RadioChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'rounded-full border px-4 py-1.5 text-sm transition-all duration-200 cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        selected
          ? 'border-primary bg-primary text-primary-foreground shadow-[0_8px_20px_-12px_color-mix(in_oklch,var(--primary)_80%,transparent)]'
          : 'border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  testId: string;
  hint?: string;
}

function Toggle({ label, checked, onChange, testId, hint }: ToggleProps) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card/60 p-3 transition-colors hover:border-primary/30"
      data-testid={testId}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={cn(
          'mt-0.5 grid h-6 w-11 shrink-0 cursor-pointer place-items-start rounded-full p-0.5 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'size-5 rounded-full bg-background shadow-sm transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

// Suppress an unused-export warning if OperationSlug is never
// referenced here directly. The type is consumed transitively via
// SearchFilters, but we re-export the import so callers can build
// their own search-URL helpers from one place.
export type { OperationSlug, TagCategory, TagComboboxOption };
