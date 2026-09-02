'use client';

/**
 * `AddressSearchInput` — the WAI-ARIA combobox of the address search
 * (capability `address-search`, AS-2; UI surface of AS-1/AS-9).
 *
 * Why it receives the hook state instead of owning the hook:
 * - the design pins the boundary — `AddressField` (Phase 4) owns
 *   `useAddressSearch` because it also drives the details fetch and the
 *   11-key hydration; the combobox "only renders this state" (hook
 *   docblock). The `search` prop is typed as `UseAddressSearchResult`,
 *   so the consumption contract (isOpen / activeIndex / onKeyDown /
 *   close / suggestions / status) is checked by the compiler, not by
 *   convention.
 *
 * Keyboard policy lives in the hook (Phase 2 proved the navigation
 * math). This component contributes the ARIA layer (AS-2):
 * - `role=combobox` input with `aria-expanded` / `aria-controls` /
 *   `aria-activedescendant` reflecting hook state,
 * - `role=listbox` + `role=option` rendering, `aria-selected` on the
 *   active option,
 * - the collapsed-when-empty edge: the hook can be OPEN with zero
 *   predictions (successful empty result) — an empty popup is never
 *   rendered and `aria-expanded` reports false,
 * - an IME composition guard (OptionSelect precedent): Enter while
 *   composing confirms the composing text, it must not select.
 *
 * AS-9 surface: a polite live region (`aria-live="polite"`) announces
 * the loading state and the hook's calm error message inline; the input
 * keeps `aria-describedby` pointed at it, and manual typing is never
 * blocked — selection is only an enhancement over manual entry. The
 * region deliberately has NO `role="status"`: the create form's
 * error-summary contract (PropertyCreateForm.test.tsx) asserts a
 * UNIQUE `role=status` per form, and a bare aria-live div is announced
 * identically — AS-9 pins "aria-live polite", not the role.
 *
 * Pointer policy (Phase 4 addendum): options commit on `onMouseDown`,
 * not `onClick` — the input's blur-triggered `close()` collapses the
 * listbox before a click could land, so mousedown is the only event
 * that reliably reaches a still-mounted option. `select(index)` shares
 * the hook's Enter commit path (token rotation included, AS-8).
 *
 * Surface policy (property-address-ui-refine, AS-10/AS-11): the listbox
 * is an opaque `bg-popover` + `border-border` + `shadow-lg` card — no
 * glass-panel/backdrop blur, so suggestions stay legible in both themes.
 * Options expose `cursor-pointer` and a hover fill distinct from the
 * solid keyboard-active fill (`hover:bg-secondary/50` vs `bg-secondary`).
 */
import { type KeyboardEvent } from 'react';

import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

import { CONTROL_CLASSES } from '@/components/admin/properties/create/form-fields';

import type { SearchStatus, UseAddressSearchResult } from '@/hooks/useAddressSearch';

export interface AddressSearchInputProps {
  /** Control id — also the base for the listbox/option ARIA ids. */
  id: string;
  /** Visible label text; `htmlFor`/`id` association per the form a11y contract. */
  label: string;
  /** Optional placeholder — copy is owned by the parent (Phase 4 passes UI text). */
  placeholder?: string;
  /** The parent-owned search state machine (design: AddressField owns the hook). */
  search: UseAddressSearchResult;
  /**
   * AS-14 immediate-clear handler (property-address-clear-layout):
   * additive and optional so standalone combobox tests keep compiling.
   * The parent owns the clear semantics (hydration reset, list close);
   * this component only contributes the affordance and its visibility
   * rule — visible while `inputValue !== ''` (strict, no trim).
   */
  onClear?: () => void;
}

/** Loading copy for the polite live region (AS-9 calm UX). */
const LOADING_MESSAGE = 'Searching addresses…';

/** What the live region announces: loading, then the hook's error message. */
function liveMessage(status: SearchStatus, message: string | null): string {
  if (status === 'loading') {
    return LOADING_MESSAGE;
  }
  if (status === 'error') {
    return message ?? '';
  }
  return '';
}

export function AddressSearchInput({
  id,
  label,
  placeholder,
  search,
  onClear,
}: AddressSearchInputProps) {
  const {
    inputValue,
    setInputValue,
    suggestions,
    isOpen,
    activeIndex,
    status,
    error,
    onKeyDown,
    close,
    select,
  } = search;

  const listboxId = `${id}-listbox`;
  const statusId = `${id}-status`;
  const optionId = (index: number) => `${id}-option-${index}`;

  // AS-2 edge: never pop an empty listbox — the hook reports OPEN even
  // when a successful search returned zero predictions.
  const expanded = isOpen && suggestions.length > 0;

  // AS-14: the X affordance is keyed strictly to `inputValue !== ''`
  // (no trim) — whitespace-only text is still content worth clearing.
  const showClear = inputValue !== '';

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // IME guard (OptionSelect precedent): Enter during composition
    // confirms the composing text and must not select a suggestion.
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }
    onKeyDown(event);
  };

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium leading-none tracking-tight">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder={placeholder}
          value={inputValue}
          aria-expanded={expanded}
          aria-controls={expanded ? listboxId : undefined}
          aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          aria-describedby={statusId}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={close}
          className={cn(CONTROL_CLASSES, showClear && 'pr-8')}
        />
        {/*
         * AS-14 immediate-clear affordance (property-address-clear-layout):
         * absolute inside the relative wrapper so the combobox geometry
         * never shifts; `type=button` keeps it out of the form submit
         * path. The input's blur-triggered `close()` firing alongside
         * the click is harmless — the listbox is already collapsed by
         * the parent's clear (design: X handler order).
         */}
        {showClear ? (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        {expanded ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={id}
            className="absolute top-full z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
          >
            {suggestions.map((prediction, index) => (
              <li
                key={prediction.placeId}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={() => select(index)}
                className={cn(
                  'flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary/50',
                  index === activeIndex
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {prediction.structuredFormatting ? (
                  <>
                    <span className="truncate">{prediction.structuredFormatting.mainText}</span>
                    <span className="truncate text-xs text-muted-foreground/80">
                      {prediction.structuredFormatting.secondaryText}
                    </span>
                  </>
                ) : (
                  <span className="truncate">{prediction.description}</span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {/*
       * Polite live region (AS-9): `min-h-4` reserves the line so
       * appearing/disappearing status copy never shifts the layout —
       * the LoginForm precedent. No `role="status"` on purpose: the
       * create form's error-summary contract asserts a unique
       * `role=status` per form (see the docblock above).
       */}
      <div
        id={statusId}
        aria-live="polite"
        className={cn(
          'min-h-4 text-xs leading-relaxed',
          status === 'error' ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {liveMessage(status, error)}
      </div>
    </div>
  );
}
