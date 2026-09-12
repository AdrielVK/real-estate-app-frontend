/**
 * `ProfileCombobox` — searchable single-select for agent/owner profiles
 * (REQ-102/S4, REQ-103/S5).
 *
 * Mechanics cloned from the proven `TagCombobox` (design D2) but reduced
 * to single-select: filter-as-you-type input, portal listbox fixed at
 * `z-[60]`, keyboard navigation with `aria-activedescendant`, and
 * click-outside dismissal. The search page keeps its own component
 * untouched.
 *
 * The adjacent size-8 outline `+` button opens `CreateProfileModal`
 * (title-only stub). Per design D3 the OPEN STATE LIVES HERE: the
 * combobox + button + modal + focus-return are one cohesive unit, which
 * keeps `BasicInfoSection` hook-free (presentational contract).
 *
 * Stacking rule (design Accessibility): never render this component
 * inside a `Dialog` — the portal listbox and the native top layer fight.
 */

'use client';

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { ChevronDown, Plus } from 'lucide-react';

import type { CreateBusinessUserRole, ProfileOption } from '@/lib/business-users/types';
import { cn } from '@/lib/utils';

import { CreateProfileModal } from './CreateProfileModal';
import { CONTROL_CLASSES } from './form-fields';

export interface ProfileComboboxProps {
  /** Control id — injected by `Field` via `cloneElement`. */
  id?: string;
  /** Selected profile id (UUID). Empty renders the placeholder. */
  value: string;
  /** Fetch result threaded from the shell (design D5). */
  options: readonly ProfileOption[];
  /** Commits the selected profile id. */
  onChange: (id: string) => void;
  /** `+` button accessible name + modal title: "Crear agente" | "Crear propietario". */
  createLabel: string;
  /**
   * Role threaded to the create modal (PR3) — preselects the role
   * field so the created user lands in this combobox's lane.
   */
  role: CreateBusinessUserRole;
  /**
   * Passthrough for the modal's `onCreated` — the combobox itself
   * always injects + selects first (PR1); parents may observe too.
   */
  onCreated?: (option: ProfileOption) => void;
  placeholder?: string;
  /** `Field`-injected wiring. */
  name?: string;
  required?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export function ProfileCombobox({
  id,
  value,
  options,
  onChange,
  createLabel,
  role,
  onCreated,
  placeholder,
  name,
  required,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: ProfileComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  /**
   * Locally created options (PR1). The list from props is an RSC
   * snapshot — a newly created user is absent until a refetch, so it
   * is injected here and merged below. Never lifted: stuffing it into
   * the form's flat `FormValues` would pollute the DTO contract.
   */
  const [created, setCreated] = useState<ProfileOption[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  // Suppresses the reopen that `commit`'s programmatic focus would cause:
  // clicking an option blurs the input (focus lands on the portal button),
  // so refocusing it fires `onFocus` — which must not re-open the list we
  // just closed. Keyboard commits don't blur, so the flag stays inert there.
  const justCommittedRef = useRef(false);

  const listboxId = id ? `${id}-listbox` : undefined;

  // Snapshot + locally created (deduped by id) — the merged list the
  // input, filter and listbox all read (PR1).
  const allOptions = useMemo(() => {
    const seen = new Set(options.map((option) => option.id));
    return [...options, ...created.filter((option) => !seen.has(option.id))];
  }, [options, created]);

  const selected = allOptions.find((option) => option.id === value);

  // includes-match filter on the display name (S4). Empty query → full list.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...allOptions];
    return allOptions.filter((option) => option.name.toLowerCase().includes(q));
  }, [allOptions, query]);

  const positionListbox = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const r = input.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: r.bottom + 6,
      left: r.left,
      minWidth: Math.max(r.width, 220),
      zIndex: 60,
    });
  }, []);

  const openList = useCallback(() => {
    setOpen(true);
    setHighlight(0);
    positionListbox();
  }, [positionListbox]);

  const closeList = useCallback(() => setOpen(false), []);

  // Click outside — dismiss without committing (TagCombobox mechanics).
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (containerRef.current?.contains(target)) return;
      if (listboxRef.current?.contains(target)) return;
      closeList();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open, closeList]);

  const commit = useCallback(
    (profileId: string) => {
      onChange(profileId);
      setQuery('');
      closeList();
      justCommittedRef.current = true;
      inputRef.current?.focus();
    },
    [onChange, closeList],
  );

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const count = Math.max(matches.length, 1);
    const cycle = (delta: number) => {
      e.preventDefault();
      if (!open) openList();
      else setHighlight((i) => (i + delta + count) % count);
    };

    if (e.key === 'Enter') {
      // Always preventDefault: Enter on an input would submit the form.
      e.preventDefault();
      const option = matches[highlight];
      if (open && option) commit(option.id);
      else if (!open) openList();
    } else if (e.key === 'ArrowDown') {
      cycle(1);
    } else if (e.key === 'ArrowUp') {
      cycle(-1);
    } else if (open && e.key === 'Home') {
      e.preventDefault();
      setHighlight(0);
    } else if (open && e.key === 'End') {
      e.preventDefault();
      setHighlight(matches.length - 1);
    } else if (open && e.key === 'Escape') {
      e.preventDefault();
      closeList();
    }
  };

  const openModal = () => {
    closeList();
    setModalOpen(true);
  };

  // S5: closing the modal returns focus to the combobox input.
  const handleModalOpenChange = (next: boolean) => {
    setModalOpen(next);
    if (!next) inputRef.current?.focus();
  };

  // PR1: inject the created option locally and select it — the RSC
  // snapshot has no such row, so no reload is needed. Parents observe
  // via `onCreated` after the combobox has committed.
  const handleCreated = useCallback(
    (option: ProfileOption) => {
      setCreated((prev) => (prev.some((item) => item.id === option.id) ? prev : [...prev, option]));
      onChange(option.id);
      setQuery('');
      onCreated?.(option);
    },
    [onChange, onCreated],
  );

  return (
    <div ref={containerRef} className="flex items-start gap-2">
      <div className="relative min-w-0 flex-1">
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          required={required || undefined}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={
            open && matches[highlight] ? `${id}-option-${matches[highlight].id}` : undefined
          }
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          placeholder={placeholder ?? createLabel}
          value={open ? query : (selected?.name ?? '')}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            if (!open) openList();
          }}
          onFocus={() => {
            // Programmatic refocus after committing an option must not
            // re-open the listbox (the click-outside/keyboard paths keep
            // focus on the input, so the flag only matters here).
            if (justCommittedRef.current) {
              justCommittedRef.current = false;
              return;
            }
            openList();
          }}
          onKeyDown={handleKeyDown}
          className={cn(CONTROL_CLASSES, 'pr-9')}
          data-testid={`profile-combobox-${id}`}
        />
        <ChevronDown
          aria-hidden
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </div>

      <button
        type="button"
        onClick={openModal}
        aria-label={createLabel}
        className="grid size-8 shrink-0 place-items-center self-center rounded-md border border-input bg-background/40 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        data-testid={`create-profile-${id}`}
      >
        <Plus aria-hidden className="size-4" />
      </button>

      {open && listboxId
        ? createPortal(
            <div
              ref={listboxRef}
              id={listboxId}
              role="listbox"
              aria-labelledby={id}
              style={dropdownStyle}
              className="glass-panel fixed rounded-lg border border-border/70 p-1.5"
              data-testid={`profile-combobox-listbox-${id}`}
            >
              {matches.length > 0 ? (
                matches.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    id={`${id}-option-${option.id}`}
                    role="option"
                    aria-selected={option.id === value}
                    onMouseEnter={() => setHighlight(index)}
                    // `commit` touches refs only in its click-time body —
                    // never during render. The `react-hooks/refs` flag is
                    // a false positive triggered by the task-mandated
                    // `allOptions` useMemo upstream: this line is
                    // byte-identical to the passing HEAD version.
                    // eslint-disable-next-line react-hooks/refs
                    onClick={() => commit(option.id)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      index === highlight
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50',
                    )}
                  >
                    {option.name}
                  </button>
                ))
              ) : (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  Sin coincidencias para &ldquo;{query.trim()}&rdquo;.
                </p>
              )}
            </div>,
            document.body,
          )
        : null}

      <CreateProfileModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        title={createLabel}
        role={role}
        onCreated={handleCreated}
      />
    </div>
  );
}
