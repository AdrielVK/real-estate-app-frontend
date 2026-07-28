'use client';

import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { startTransition } from 'react';
import { createPortal } from 'react-dom';

import { useRouter, useSearchParams } from 'next/navigation';

import { ChevronDown, DollarSign, Home, Loader2, MapPin, Search, SlidersHorizontal } from 'lucide-react';

import type { Currency, OperationSlug, PropertyTypeSlug, SearchFilters } from '@/types/publication';
import {
  DEFAULT_FILTERS,
  OPERATION_LABEL,
  PROPERTY_TYPE_LABEL,
  serializeFilters,
} from '@/lib/search/url';
import { cn } from '@/lib/utils';

import { SearchResultsAdvancedFilters } from '@/components/public/SearchResultsAdvancedFilters';
import { TagCombobox, type TagComboboxOption } from '@/components/public/TagCombobox';
import { Button } from '@/components/ui/Button';

const PROPERTY_TYPE_OPTIONS: readonly TagComboboxOption[] = (
  Object.entries(PROPERTY_TYPE_LABEL) as [PropertyTypeSlug, string][]
).map(([slug, label]) => ({ slug, label }));

const OPERATION_OPTIONS: readonly { slug: OperationSlug; label: string }[] = (
  Object.entries(OPERATION_LABEL) as [OperationSlug, string][]
).map(([slug, label]) => ({ slug, label }));

const CURRENCY_TOGGLE: readonly { value: Currency; label: string }[] = [
  { value: 'ARS', label: 'ARS' },
  { value: 'USD', label: 'USD' },
];

export interface SearchResultsFilterBarProps {
  /**
   * Initial filter set, normally parsed from the URL on the server.
   * The bar uses this only for its first render — the parent's
   * `key={JSON.stringify(serialized)}` strategy is what guarantees
   * the bar resets after every navigation.
   */
  initialFilters: SearchFilters;
  /** Path the bar pushes to on commit. Defaults to `/buscar`. */
  basePath?: string;
  /**
   * Test hook — override the router. Lets us assert the URL the bar
   * would push to without depending on `next/navigation` plumbing.
   */
  onCommit?: (params: URLSearchParams) => void;
}

/**
 * `SearchResultsFilterBar` — the single client island on `/buscar`.
 *
 * Owns the draft `SearchFilters` for the duration of a single URL
 * state and commits to the URL on `Buscar` (or on the advanced
 * modal's `Aplicar`). The page passes a `key={serialized}` so the
 * bar is fully remounted after every navigation — that means we
 * never have to reconcile draft ↔ URL ourselves.
 *
 * Composition (desktop, `sm:` and up):
 *   `[location tags] | [property types] | [operation dropdown] | [price dropdown] | [Filtros completos] [Buscar]`
 *
 * Mobile: the row stacks vertically via `flex-col`, each control
 * spans the full width, and the dividers are hidden via `hidden sm:block`.
 *
 * Commit semantics
 * - `commit()` serializes the draft, resets `page` to 1, and pushes
 *   the new URL via `router.push` inside `startTransition` so the
 *   loading skeleton can take over without losing the bar's UI.
 * - `scroll: false` keeps the user anchored to the bar position.
 */
export function SearchResultsFilterBar({
  initialFilters,
  basePath = '/buscar',
  onCommit,
}: SearchResultsFilterBarProps) {
  // Use the router hook only when no test override is provided.
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Draft state — local-only until commit. The bar remounts on every
  // URL change so we don't need to reconcile this from `searchParams`.
  const [draft, setDraft] = useState<SearchFilters>(initialFilters);
  const [locationTags, setLocationTags] = useState<string[]>(() =>
    initialFilters.locationText ? [initialFilters.locationText] : [],
  );

  // ── Commit to URL ───────────────────────────────────────────────────
  const commit = useCallback(
    (next: SearchFilters) => {
      const params = serializeForCommit(next, locationTags);
      const query = params.toString();
      const href = query ? `${basePath}?${query}` : basePath;
      if (onCommit) {
        onCommit(params);
        return;
      }
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [basePath, locationTags, onCommit, router],
  );

  // Pending indicator — flip on while the URL searchParams differs
  // from the last commit. The bar is keyed on the parent, so a new
  // mount resets this to `false` automatically.
  const lastCommittedRef = useRef<string | null>(null);
  useEffect(() => {
    const current = searchParams?.toString() ?? '';
    if (lastCommittedRef.current === null) {
      lastCommittedRef.current = current;
      return;
    }
    if (current !== lastCommittedRef.current) {
      setPending(true);
      lastCommittedRef.current = current;
    }
  }, [searchParams]);

  // ── Operation select (portal) ───────────────────────────────────────
  const [operationOpen, setOperationOpen] = useState(false);
  const [operationStyle, setOperationStyle] = useState<React.CSSProperties>({});
  const operationTriggerRef = useRef<HTMLButtonElement>(null);
  const operationDropdownRef = useRef<HTMLDivElement>(null);

  // ── Price dropdown (portal panel) ──────────────────────────────────
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceStyle, setPriceStyle] = useState<React.CSSProperties>({});
  const [priceDraft, setPriceDraft] = useState<{
    min: string;
    max: string;
    currency: Currency;
  }>(() => ({
    min: initialFilters.priceMin === undefined ? '' : String(initialFilters.priceMin),
    max: initialFilters.priceMax === undefined ? '' : String(initialFilters.priceMax),
    currency: initialFilters.currency,
  }));
  const priceTriggerRef = useRef<HTMLButtonElement>(null);
  const priceDropdownRef = useRef<HTMLDivElement>(null);

  const closeAll = useCallback(() => {
    setOperationOpen(false);
    setPriceOpen(false);
  }, []);

  // Position portal panels when their dropdown opens.
  useEffect(() => {
    if (!operationOpen) return;
    const r = operationTriggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setOperationStyle({
      position: 'fixed',
      top: r.bottom + 6,
      left: r.left,
      minWidth: Math.max(r.width, 220),
      zIndex: 50,
    });
  }, [operationOpen]);
  useEffect(() => {
    if (!priceOpen) return;
    const r = priceTriggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setPriceStyle({
      position: 'fixed',
      top: r.bottom + 6,
      left: r.left,
      minWidth: Math.max(r.width, 280),
      zIndex: 50,
    });
  }, [priceOpen]);

  // Close any open dropdown on scroll (SearchPanel pattern).
  useEffect(() => {
    const onScroll = () => closeAll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [closeAll]);

  // Global click-outside for the two portal panels.
  useEffect(() => {
    if (!operationOpen && !priceOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (operationOpen) {
        if (operationTriggerRef.current?.contains(target)) return;
        if (operationDropdownRef.current?.contains(target)) return;
      }
      if (priceOpen) {
        if (priceTriggerRef.current?.contains(target)) return;
        if (priceDropdownRef.current?.contains(target)) return;
      }
      closeAll();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [operationOpen, priceOpen, closeAll]);

  // ── Operation commit ────────────────────────────────────────────────
  function selectOperation(slug: OperationSlug | undefined) {
    setDraft((prev) => ({ ...prev, operation: slug }));
    setOperationOpen(false);
  }

  // ── Price commit (applies to draft, not URL) ────────────────────────
  function applyPrice() {
    const min = priceDraft.min.trim() === '' ? undefined : Number.parseInt(priceDraft.min, 10);
    const max = priceDraft.max.trim() === '' ? undefined : Number.parseInt(priceDraft.max, 10);
    setDraft((prev) => ({
      ...prev,
      priceMin: Number.isFinite(min) ? (min as number) : undefined,
      priceMax: Number.isFinite(max) ? (max as number) : undefined,
      currency: priceDraft.currency,
    }));
    setPriceOpen(false);
  }

  const priceSummary = useMemo(() => {
    const min = draft.priceMin;
    const max = draft.priceMax;
    if (min === undefined && max === undefined) return 'Precio';
    if (min !== undefined && max !== undefined) return `${min}–${max} ${draft.currency}`;
    if (min !== undefined) return `Desde ${min} ${draft.currency}`;
    return `Hasta ${max} ${draft.currency}`;
  }, [draft.priceMin, draft.priceMax, draft.currency]);

  return (
    <div
      className="glass-panel rounded-3xl border border-border/70 p-2"
      data-testid="filter-bar"
    >
      <div className="flex flex-col gap-2 sm:h-14 sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:pl-3">
        {/* Location */}
        <div className="min-w-0 flex-1">
          <TagCombobox
            label="Zona, barrio o dirección"
            icon={<MapPin aria-hidden className="size-4" />}
            options={[]}
            value={locationTags}
            onChange={setLocationTags}
            mode="free-text"
            placeholder="Zona, barrio o dirección"
          />
        </div>

        <Divider />

        {/* Property types */}
        <div className="min-w-0 flex-1">
          <TagCombobox
            label="Tipo de propiedad"
            icon={<Home aria-hidden className="size-4" />}
            options={PROPERTY_TYPE_OPTIONS}
            value={draft.propertyTypes}
            onChange={(next) =>
              setDraft((prev) => ({ ...prev, propertyTypes: next as PropertyTypeSlug[] }))
            }
            mode="predefined"
            placeholder="Tipo de propiedad"
          />
        </div>

        <Divider />

        {/* Operation */}
        <div className="relative shrink-0 sm:w-44">
          <button
            ref={operationTriggerRef}
            type="button"
            onClick={() =>
              operationOpen ? setOperationOpen(false) : (closeAll(), setOperationOpen(true))
            }
            className={cn(
              'flex h-11 w-full cursor-pointer items-center gap-2 rounded-full px-3 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              draft.operation ? 'text-foreground' : 'text-muted-foreground',
            )}
            data-testid="operation-trigger"
            aria-haspopup="listbox"
            aria-expanded={operationOpen}
          >
            <span className="truncate">
              {draft.operation ? OPERATION_LABEL[draft.operation] : 'Operación'}
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                'pointer-events-none ml-auto size-4 shrink-0 text-muted-foreground transition-transform',
                operationOpen && 'rotate-180',
              )}
            />
          </button>
          {operationOpen
            ? createPortal(
                <OperationListbox
                  ref={operationDropdownRef}
                  style={operationStyle}
                  value={draft.operation}
                  onSelect={selectOperation}
                />,
                document.body,
              )
            : null}
        </div>

        <Divider />

        {/* Price */}
        <div className="relative shrink-0 sm:w-44">
          <button
            ref={priceTriggerRef}
            type="button"
            onClick={() => (priceOpen ? setPriceOpen(false) : (closeAll(), setPriceOpen(true)))}
            className={cn(
              'flex h-11 w-full cursor-pointer items-center gap-2 rounded-full px-3 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              draft.priceMin !== undefined || draft.priceMax !== undefined
                ? 'text-foreground'
                : 'text-muted-foreground',
            )}
            data-testid="price-trigger"
            aria-haspopup="dialog"
            aria-expanded={priceOpen}
          >
            <DollarSign aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{priceSummary}</span>
            <ChevronDown
              aria-hidden
              className={cn(
                'pointer-events-none ml-auto size-4 shrink-0 text-muted-foreground transition-transform',
                priceOpen && 'rotate-180',
              )}
            />
          </button>
          {priceOpen
            ? createPortal(
                <PricePanel
                  ref={priceDropdownRef}
                  style={priceStyle}
                  value={priceDraft}
                  onChange={setPriceDraft}
                  onApply={applyPrice}
                  onClose={() => setPriceOpen(false)}
                />,
                document.body,
              )
            : null}
        </div>

        {/* Advanced + Buscar */}
        <div className="flex shrink-0 items-center gap-1.5 self-end sm:ml-2 sm:self-center">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setAdvancedOpen(true)}
            className="h-11 cursor-pointer rounded-full"
            data-testid="filter-bar-advanced"
            aria-label="Abrir filtros completos"
          >
            <SlidersHorizontal aria-hidden className="size-4" />
            <span className="hidden sm:inline">Filtros completos</span>
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => commit(draft)}
            disabled={pending}
            className="h-11 cursor-pointer rounded-full px-5"
            data-testid="filter-bar-buscar"
          >
            {pending ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <Search aria-hidden className="size-4" />
            )}
            Buscar
          </Button>
        </div>
      </div>

      <SearchResultsAdvancedFilters
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        value={draft}
        onApply={(patch) => {
          setDraft(patch);
          commit(patch);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Local UI primitives                                                */
/* ------------------------------------------------------------------ */

function Divider() {
  return (
    <span aria-hidden className="hidden h-8 w-px shrink-0 bg-border sm:block" />
  );
}

interface OperationListboxProps {
  style: React.CSSProperties;
  value: OperationSlug | undefined;
  onSelect: (slug: OperationSlug | undefined) => void;
}

const OperationListbox = forwardRef<HTMLDivElement, OperationListboxProps>(
  function OperationListbox({ style, value, onSelect }, ref) {
    const id = useId();
    return (
      <div
        ref={ref}
        id={id}
        role="listbox"
        style={style}
        data-testid="operation-listbox"
        className="glass-panel rounded-2xl border border-border/70 p-1.5"
      >
        <button
          type="button"
          role="option"
          aria-selected={value === undefined}
          onClick={() => onSelect(undefined)}
          className={cn(
            'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
            value === undefined
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:bg-secondary/50',
          )}
        >
          Cualquiera
        </button>
        {OPERATION_OPTIONS.map((op) => (
          <button
            key={op.slug}
            type="button"
            role="option"
            aria-selected={value === op.slug}
            onClick={() => onSelect(op.slug)}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
              value === op.slug
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:bg-secondary/50',
            )}
          >
            {op.label}
          </button>
        ))}
      </div>
    );
  },
);

interface PricePanelProps {
  style: React.CSSProperties;
  value: { min: string; max: string; currency: Currency };
  onChange: (next: { min: string; max: string; currency: Currency }) => void;
  onApply: () => void;
  onClose: () => void;
}

const PricePanel = forwardRef<HTMLDivElement, PricePanelProps>(function PricePanel(
  { style, value, onChange, onApply, onClose },
  ref,
) {
  return (
    <div
      ref={ref}
      style={style}
      data-testid="price-panel"
      className="glass-panel rounded-2xl border border-border/70 p-4"
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Mínimo</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={value.min}
              onChange={(e) => onChange({ ...value, min: e.target.value })}
              data-testid="price-min"
              className="h-9 rounded-full border border-border bg-background/70 px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Máximo</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={value.max}
              onChange={(e) => onChange({ ...value, max: e.target.value })}
              data-testid="price-max"
              className="h-9 rounded-full border border-border bg-background/70 px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          </label>
        </div>
        <div className="flex items-center gap-1.5" data-testid="price-currency">
          {CURRENCY_TOGGLE.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={value.currency === c.value}
              onClick={() => onChange({ ...value, currency: c.value })}
              data-testid={`price-currency-${c.value}`}
              className={cn(
                'h-8 flex-1 cursor-pointer rounded-full border text-xs font-medium transition-all duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                value.currency === c.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card/60 text-muted-foreground hover:border-primary/40',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="cursor-pointer rounded-full"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onApply}
            className="cursor-pointer rounded-full"
            data-testid="price-apply"
          >
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Commit serializer                                                  */
/* ------------------------------------------------------------------ */

/**
 * Build the URLSearchParams the bar will push. Resets `page` to 1
 * because a filter change always starts a new result set.
 *
 * Mirrors `serializeFilters` but bakes in the "first location tag
 * only" rule from the spec and always clears `page` even if the
 * caller had it set.
 */
function serializeForCommit(draft: SearchFilters, locationTags: string[]): URLSearchParams {
  const locationText = locationTags[0]?.trim() || undefined;
  const next: SearchFilters = {
    ...DEFAULT_FILTERS,
    ...draft,
    locationText,
    page: 1,
  };
  return serializeFilters(next);
}

// Suppress unused-symbol lint errors on the type-only re-exports.
// We re-export `OPERATION_LABEL` above; keep the symbol accessible
// from this module even when other modules tree-shake it out.
void DEFAULT_FILTERS;
