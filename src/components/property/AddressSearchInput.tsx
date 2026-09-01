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
 * AS-9 surface: a polite live region (`role=status`) announces the
 * loading state and the hook's calm error message inline; the input
 * keeps `aria-describedby` pointed at it, and manual typing is never
 * blocked — selection is only an enhancement over manual entry.
 *
 * Pointer policy (Phase 4 addendum): options commit on `onMouseDown`,
 * not `onClick` — the input's blur-triggered `close()` collapses the
 * listbox before a click could land, so mousedown is the only event
 * that reliably reaches a still-mounted option. `select(index)` shares
 * the hook's Enter commit path (token rotation included, AS-8).
 */
import { type KeyboardEvent } from 'react';

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

export function AddressSearchInput({ id, label, placeholder, search }: AddressSearchInputProps) {
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
          className={CONTROL_CLASSES}
        />
        {expanded ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={id}
            className="glass-panel absolute top-full z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border/70 p-1.5"
          >
            {suggestions.map((prediction, index) => (
              <li
                key={prediction.placeId}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={() => select(index)}
                className={cn(
                  'flex flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm',
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
       * the LoginForm precedent.
       */}
      <div
        id={statusId}
        role="status"
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
