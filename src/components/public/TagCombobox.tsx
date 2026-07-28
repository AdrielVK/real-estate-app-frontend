'use client';

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { ChevronDown, X } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface TagComboboxOption {
  /** Stable slug used in the URL — comparison and serialization. */
  slug: string;
  /** Human label rendered in the chip + listbox. */
  label: string;
}

export interface TagComboboxProps {
  /** Accessible label for the combobox (also used as placeholder prefix). */
  label: string;
  /** Lucide-style icon component for the leading icon. */
  icon: ReactNode;
  /** Options available for selection. Required, but may be `[]` for pure free-text. */
  options: readonly TagComboboxOption[];
  /** Current tag set. */
  value: string[];
  /** Called whenever the tag set changes. */
  onChange: (next: string[]) => void;
  /**
   * `'predefined'` (default) — only `options` may be added. Typing a
   * custom value and pressing Enter does NOT add a tag; the user
   * must pick a suggestion.
   * `'free-text'` — Enter adds whatever is in the input even if it
   * does not match a suggestion. Suggestions are still used to
   * autocomplete, but the user is not forced to pick them.
   */
  mode?: 'predefined' | 'free-text';
  /** Maximum number of tags. Defaults to 4 (matches SearchPanel). */
  maxTags?: number;
  /**
   * Called whenever THIS combobox opens. The bar can use this to
   * close other comboboxes (mutual exclusion — SearchPanel pattern).
   */
  onOpen?: () => void;
  /** Placeholder text shown when no tags are present. */
  placeholder?: string;
  /** Test hook for components that need to read the trigger ref. */
  className?: string;
}

const SUGGESTION_LIMIT = 8;
const DEFAULT_MAX_TAGS = 4;

/**
 * `TagCombobox` — chip-and-combobox input used by the search results
 * page filter bar.
 *
 * Extracted from the home page `SearchPanel` pattern (chips with X,
 * portal listbox, keyboard nav, mutual exclusion via parent) so it
 * can be reused for the location field, property type multi-select,
 * and the four tag-category comboboxes inside the advanced filters
 * modal.
 *
 * Two modes:
 * - `'predefined'` (default) — strict, the user can only add tags
 *   that exist in `options`. Best for property types and amenity
 *   tags, where the slug must match the backend.
 * - `'free-text'` — Enter adds the input value verbatim, even if it
 *   does not match any suggestion. Best for the location field.
 *
 * Behavioral notes (SEARCH-4 + AiSearchDialog inspiration):
 * - Focus / click on the input opens the listbox.
 * - ArrowDown/Up cycle the highlight (wraps).
 * - Enter adds the highlighted option (or, in `free-text` mode, the
 *   current input).
 * - Escape closes the listbox or clears the input.
 * - The listbox is portaled to `document.body` so it escapes any
 *   `glass-panel` stacking context (proven SearchPanel fix).
 * - The bar coordinates mutual exclusion via the `onOpen` callback.
 * - `maxTags` is enforced silently — exceeding it returns the
 *   existing value unchanged.
 */
export function TagCombobox({
  label,
  icon,
  options,
  value,
  onChange,
  mode = 'predefined',
  maxTags = DEFAULT_MAX_TAGS,
  onOpen,
  placeholder,
  className,
}: TagComboboxProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const listboxId = useId();

  const limitReached = value.length >= maxTags;
  const valueSet = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  // ── Suggestions (filtered by input, deduped vs current value set) ───
  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    const filtered = options.filter((opt) => {
      if (valueSet.has(opt.slug.toLowerCase())) return false;
      if (!q) return true;
      return opt.label.toLowerCase().includes(q) || opt.slug.toLowerCase().includes(q);
    });
    return filtered.slice(0, SUGGESTION_LIMIT);
  }, [input, options, valueSet]);

  // ── Position the portal under the trigger ───────────────────────────
  const recomputePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: r.bottom + 6,
      left: r.left,
      minWidth: Math.max(r.width, 240),
      zIndex: 50,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    recomputePosition();
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [open, recomputePosition]);

  // ── Open helpers ────────────────────────────────────────────────────
  const openList = useCallback(() => {
    onOpen?.();
    setOpen(true);
    setHighlight(0);
  }, [onOpen]);

  // ── Click outside ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  // ── Tag add / remove ────────────────────────────────────────────────
  const addTag = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || limitReached) return;

      // For 'predefined' mode, resolve the trimmed text to a known
      // option. Either by exact slug, by case-insensitive label, or
      // by exact label. Unknown values are ignored.
      if (mode === 'predefined') {
        const lower = trimmed.toLowerCase();
        const match = options.find(
          (o) =>
            o.slug === trimmed || o.slug.toLowerCase() === lower || o.label.toLowerCase() === lower,
        );
        if (!match) return;
        if (valueSet.has(match.slug.toLowerCase())) return;
        onChange([...value, match.slug]);
        setInput('');
        setOpen(false);
        return;
      }

      // 'free-text' mode: dedupe case-insensitively against the current
      // set. Empty after trim was guarded above.
      if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) return;
      onChange([...value, trimmed]);
      setInput('');
      setOpen(false);
    },
    [limitReached, mode, onChange, options, value, valueSet],
  );

  const removeTag = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [onChange, value],
  );

  // ── Keyboard ────────────────────────────────────────────────────────
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.key === 'Enter') {
      // Free-text mode: Enter always commits the current input verbatim,
      // even when a suggestion is highlighted. This was the bug — the
      // old code preferred suggestions[highlight] whenever it was
      // truthy, so typing "Pal" + Enter added "palermo" instead of
      // letting the user add a custom tag. To add a suggestion in
      // free-text mode, the user clicks it.
      if (mode === 'free-text' && input.trim()) {
        e.preventDefault();
        addTag(input);
        return;
      }
      if (open && suggestions[highlight]) {
        e.preventDefault();
        addTag(suggestions[highlight].slug);
        return;
      }
      if (input.trim()) {
        e.preventDefault();
        addTag(input);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openList();
      setHighlight((i) => (i + 1) % Math.max(suggestions.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => (i === 0 ? Math.max(suggestions.length - 1, 0) : i - 1));
    } else if (e.key === 'Escape') {
      if (open) {
        setOpen(false);
      } else if (input) {
        setInput('');
        setHighlight(0);
      }
    }
  };

  return (
    <div ref={triggerRef} className={cn('relative min-w-0', className)}>
      <div className="flex h-11 items-center gap-1.5 overflow-hidden rounded-full px-3">
        {value.length === 0 ? (
          <span aria-hidden className="shrink-0 text-muted-foreground">
            {icon}
          </span>
        ) : null}

        {value.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-secondary-foreground"
          >
            <span className="max-w-[10ch] truncate">{labelOf(tag, options)}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
              className="grid size-4 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-foreground/10"
              aria-label={`Quitar ${labelOf(tag, options)}`}
            >
              <X aria-hidden className="size-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={input}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-label={label}
          placeholder={value.length === 0 ? (placeholder ?? label) : ''}
          onChange={(e) => {
            setInput(e.target.value);
            setHighlight(0);
            if (!open) openList();
          }}
          onFocus={() => openList()}
          onKeyDown={handleKeyDown}
          className={cn(
            'h-full min-w-[80px] flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-none',
          )}
          data-testid={`tag-combobox-input-${slugify(label)}`}
        />

        <ChevronDown
          aria-hidden
          className={cn(
            'pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </div>

      {open
        ? createPortal(
            <div
              ref={dropdownRef}
              id={listboxId}
              role="listbox"
              aria-multiselectable="true"
              style={dropdownStyle}
              className="glass-panel rounded-2xl border border-border/70 p-1.5"
              data-testid={`tag-combobox-listbox-${slugify(label)}`}
            >
              {limitReached ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  Máximo {maxTags} {maxTags === 1 ? 'opción' : 'opciones'}
                </p>
              ) : suggestions.length > 0 ? (
                suggestions.map((opt, i) => (
                  <button
                    key={opt.slug}
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => addTag(opt.slug)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                      i === highlight
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50',
                    )}
                  >
                    {opt.label}
                  </button>
                ))
              ) : mode === 'predefined' ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  {input.trim()
                    ? `Sin coincidencias para "${input.trim()}".`
                    : 'Elegí una opción.'}
                </p>
              ) : (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  {input.trim()
                    ? `No encontramos "${input.trim()}". Presioná Enter para agregarlo.`
                    : 'Escribí para buscar.'}
                </p>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * Resolve a stored tag value to a human label. Used in chips so the
 * user sees "Casa" instead of "casa" when the slug/label differ in
 * casing or accent marks.
 */
function labelOf(slug: string, options: readonly TagComboboxOption[]): string {
  const match = options.find((o) => o.slug === slug);
  return match?.label ?? slug;
}

/**
 * Stable slug for `data-testid` derived from a label. Best-effort:
 * lowercases, replaces non-alphanumerics with `-`. The `useId()`
 * already covers uniqueness for a11y IDs, so this only needs to be
 * stable enough for tests to find the element.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
