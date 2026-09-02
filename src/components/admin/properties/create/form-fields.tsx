/**
 * Shared form primitives for the admin property-create form.
 *
 * Redesign (ops-team job: speed + scan-able error mapping):
 * - Tokens stay on CSS vars (`border-input`, `bg-background/40`, etc.) — no hex.
 * - Controls keep `h-11` (44 px touch target) and gain `text-[16px] sm:text-sm`
 *   so iOS never auto-zooms on focus (ux `readable-font-size`).
 * - `SectionShell` is the signature element: a left-rule (copper when
 *   active/focus-within, destructive when errored, muted otherwise) that
 *   turns validation state into ambient spatial info for vertical scanning.
 *   Quiet by default, the single deliberate risk the frontend-design
 *   brief asks for.
 * - Transitions respect `prefers-reduced-motion` via globals.css.
 *
 * Why these live in `create/form-fields.tsx` (not `src/components/ui/`)?
 * - Single consumer (create form + its 4 sections), so they stay local to
 *   the feature — the LoginForm precedent. A `ui/` primitive would imply
 *   a second consumer that does not exist yet.
 *
 * Why raw `<input>`/`<select>` children instead of a controlled `Field`
 * that renders the control itself?
 * - Sections own control props (type/value/onChange/inputMode); `Field`
 *   owns label association + `id`/`name`/`aria-*` wiring via `cloneElement`.
 *
 * Accessibility contract (spec "Design Tokens & A11y"):
 * - Every control gets `id`; `<label htmlFor>` matches it.
 * - Error → `aria-invalid="true"` + `aria-describedby` on the inline message.
 * - Hint (no error) → `aria-describedby` points at the hint.
 *
 * Token discipline (spec NFR "Design Token Compliance"):
 * - `border-input`, `bg-background/40`, `text-muted-foreground`,
 *   `text-destructive` only — no hex. `aria-invalid:border-destructive`
 *   couples visuals to semantics.
 */

import {
  cloneElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Token class constants — the single styling source for the create form.     */
/* -------------------------------------------------------------------------- */

/**
 * Shared control classes for raw `<input>` and native `<select>` elements.
 * `text-[16px]` on mobile prevents iOS auto-zoom; `sm:text-sm` restores the
 * tighter ops density on ≥640 px. `placeholder:text-muted-foreground/60`
 * keeps guidance visible but quiet.
 */
export const CONTROL_CLASSES =
  'h-11 min-h-[44px] w-full rounded-md border border-input bg-background/40 px-3 text-[16px] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/60 aria-invalid:border-destructive focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:text-sm';

/** Label treatment — `text-sm font-medium` with tight tracking for hierarchy. */
const LABEL_CLASSES = 'text-sm font-medium leading-none tracking-tight';

/** Inline field-error copy — destructive token, never hex. */
const ERROR_CLASSES = 'text-sm leading-snug text-destructive';

/** Optional hint copy — muted token. */
const HINT_CLASSES = 'text-xs leading-relaxed text-muted-foreground';

/** Slug/mono preview — utility face for derived system values. */
export const SLUG_PREVIEW_CLASSES =
  'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 font-mono text-xs text-muted-foreground';

/* -------------------------------------------------------------------------- */
/* Section chrome — the signature left-rule card                                */
/* -------------------------------------------------------------------------- */

export interface SectionShellProps {
  /** Eyebrow step label, e.g. "01 · Básico". Rendered as aria-hidden decoration. */
  eyebrow: string;
  /** Visible legend text (Spanish). */
  title: string;
  /** Short descriptor under the legend. */
  description?: string;
  /** When true, paints the left-rule + header in destructive tones. */
  hasError?: boolean;
  /** When true, marks the section as completed in the stepper context. */
  completed?: boolean;
  /**
   * Optional right-cluster action sharing the header row with the title
   * (physical-features-ux D3) — e.g. the features enable toggle. It
   * renders OUTSIDE the `aria-hidden` text block on purpose: the header
   * text is decoration (the `<legend>` already names the group) but an
   * interactive control must stay visible to assistive tech.
   */
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * `SectionShell` — fieldset chrome for the redesign.
 *
 * Signature: a 2 px left-rule that encodes state peripherally:
 * - default: `border-border` muted
 * - focus-within: `border-copper/50` + subtle `bg-copper/[0.04]` tint
 * - error: `border-destructive` + `bg-destructive/[0.04]`
 * This lets an ops user scanning vertically spot "where am I broken?"
 * without reading every inline error. Motion is limited to border/background
 * transitions (transform/opacity only when lists stagger).
 */
export function SectionShell({
  eyebrow,
  title,
  description,
  hasError,
  headerAction,
  children,
  className,
}: SectionShellProps) {
  return (
    <fieldset
      className={cn(
        'group/section relative grid gap-5 overflow-hidden rounded-lg border bg-card/50 p-4 shadow-[0_1px_2px_color-mix(in_oklch,var(--border)_60%,transparent)] transition-[border-color,background-color,box-shadow] duration-200 sm:p-5',
        'border-l-[3px]',
        hasError
          ? 'border-border border-l-destructive bg-destructive/[0.04] focus-within:border-l-destructive'
          : 'border-border border-l-border focus-within:border-l-copper/60 focus-within:bg-copper/[0.04] focus-within:shadow-[0_8px_24px_-16px_color-mix(in_oklch,var(--primary)_30%,transparent)]',
        className,
      )}
    >
      <legend className="sr-only">{title}</legend>
      {/* D3 (physical-features-ux): `aria-hidden` moved from the whole
          header row to the title text block only — the row may carry a
          `headerAction` control that AT must be able to reach. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div aria-hidden="true" className="space-y-1">
          <p
            className={cn(
              'font-sans text-xs font-medium tracking-tight',
              hasError ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {eyebrow}
          </p>
          <p className="text-[15px] font-semibold leading-none tracking-tight">{title}</p>
          {description ? (
            <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {headerAction || hasError ? (
          <div className="flex flex-col items-end gap-2">
            {headerAction}
            {hasError ? (
              <span className="inline-flex items-center rounded-full bg-destructive px-2.5 py-1 text-[11px] font-medium leading-none text-white">
                Revisar
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {children}
    </fieldset>
  );
}

/* -------------------------------------------------------------------------- */
/* FieldError                                                                 */
/* -------------------------------------------------------------------------- */

export interface FieldErrorProps {
  /** Element id the control's `aria-describedby` points at. */
  id?: string;
  /** Error copy to display. Absent/empty renders nothing. */
  message?: string;
}

/**
 * The inline error line. Lives outside `Field` as its own export so
 * composite sections (characteristic rows in PR 3) can render errors
 * without re-wiring a label association.
 */
export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} className={ERROR_CLASSES}>
      {message}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Field                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The subset of control props `Field` injects via `cloneElement`.
 * Both `<input>` and `<select>` attribute interfaces are structurally
 * assignable to it — every key is an optional member they already
 * declare.
 */
interface ControlProps {
  id?: string;
  name?: string;
  required?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export interface FieldProps {
  /** Control id — also used as the `name` and the error/hint id prefix. */
  id: string;
  /** Visible label text (Spanish UI copy, project convention). */
  label: string;
  /** Current error copy. Truthy → `aria-invalid` + inline message. */
  error?: string;
  /** Optional guidance shown under the control while the field is clean. */
  hint?: string;
  /** Marks the control `required` for semantics/AT (the form is `noValidate`). */
  required?: boolean;
  /** The raw `<input>`/`<select>` element; `Field` wires id/name/aria onto it. */
  children: ReactElement<ControlProps>;
}

/**
 * Label + control + error/hint wrapper.
 *
 * `cloneElement` injects `id`, `name`, `aria-invalid`,
 * `aria-describedby`, and `required` onto the child control. The child
 * keeps everything else (value, onChange, type, inputMode, options)
 * so sections stay declarative.
 */
export function Field({ id, label, error, hint, required, children }: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  // Error wins over hint: while a field is invalid, the guidance is
  // suppressed and the description points at the reason instead.
  let describedBy: string | undefined;
  if (error) {
    describedBy = errorId;
  } else if (hint) {
    describedBy = hintId;
  }

  const control = cloneElement(children, {
    id,
    name: id,
    required: required || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  });

  return (
    <div className="grid gap-2">
      {/* REQ-006 (design D6): the hint moved inline on the label row —
          short guidance ("Opcional") sits right of the label instead of
          adding a line under the control. Error still wins below. */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className={LABEL_CLASSES}>
          {label}
        </label>
        {!error && hint ? (
          <span id={hintId} className={HINT_CLASSES}>
            {hint}
          </span>
        ) : null}
      </div>
      {control}
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* OptionSelect — app-styled single-select listbox (REQ-004)                   */
/* -------------------------------------------------------------------------- */

export interface OptionSelectProps {
  /** Control id — injected by `Field` via `cloneElement`. */
  id?: string;
  /** Currently selected slug. Empty string renders the placeholder. */
  value: string;
  /** Choices — `value` stays the slug, `label` is the display copy (REQ-005). */
  options: readonly { value: string; label: string }[];
  /** Commits the selected slug. */
  onChange: (value: string) => void;
  /** Copy shown on the trigger while nothing is selected. */
  placeholder?: string;
  /** Error copy — drives `aria-invalid` (message itself is rendered by `Field`). */
  error?: string;
  /** Props injected by `Field`'s `cloneElement` wiring. */
  name?: string;
  required?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * `OptionSelect` — button trigger + portal listbox replacing the native
 * OS `<select>` for closed option sets (Estado, Tipo).
 *
 * Mechanics cloned from the proven `TagCombobox` pattern (design D1) but
 * reduced to single-select with no text input: the trigger always shows
 * the selected SEMANTIC label while the committed value stays the slug.
 *
 * Keyboard contract (design Accessibility section):
 * - Enter/Space: open (closed) or commit the highlighted option (open).
 *   Both are preventDefault-ed so the trigger never submits the form.
 * - ArrowDown/ArrowUp: cycle the highlight (wraps).
 * - Home/End: jump to first/last option.
 * - Escape: close; focus returns to the trigger.
 * - Outside mousedown: close without committing.
 *
 * The listbox is portaled to `document.body` with `z-[60]` so it escapes
 * the `glass-panel` stacking context and sits above dialog backdrops —
 * comboboxes must never be rendered inside a `Dialog` (top-layer conflict).
 */
export function OptionSelect({
  id,
  value,
  options,
  onChange,
  placeholder,
  error,
  name,
  required,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: OptionSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const listboxId = id ? `${id}-listbox` : undefined;
  const optionId = (v: string) => (id ? `${id}-option-${v}` : undefined);
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const selectedLabel = options.find((option) => option.value === value)?.label;

  const recomputePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: r.bottom + 6,
      left: r.left,
      minWidth: Math.max(r.width, 200),
      zIndex: 60,
    });
  }, []);

  const openList = useCallback(() => {
    setOpen(true);
    setHighlight(selectedIndex);
    recomputePosition();
  }, [recomputePosition, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [open]);

  // Click outside — close without committing (TagCombobox mechanics).
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

  const commit = useCallback(
    (next: string) => {
      onChange(next);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange],
  );

  const closeList = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const count = Math.max(options.length, 1);
    const cycle = (delta: number) => {
      e.preventDefault();
      if (!open) openList();
      else setHighlight((i) => (i + delta + count) % count);
    };

    if (e.key === 'Enter' || e.key === ' ') {
      // preventDefault always: Enter on a button inside the form would
      // otherwise submit it, and Space would re-trigger the click toggle.
      e.preventDefault();
      const option = options[highlight];
      if (open && option) commit(option.value);
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
      setHighlight(options.length - 1);
    } else if (open && e.key === 'Escape') {
      e.preventDefault();
      closeList(true);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        // `required` on a custom control needs the ARIA mirror for AT —
        // native constraint validation does not apply to buttons here.
        aria-required={required || undefined}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && options[highlight] ? optionId(options[highlight].value) : undefined
        }
        aria-invalid={error ? true : ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        onClick={() => (open ? closeList(false) : openList())}
        onKeyDown={handleKeyDown}
        className={cn(
          CONTROL_CLASSES,
          'flex cursor-pointer items-center justify-between gap-2 text-left',
          !value && 'text-muted-foreground/60',
        )}
        data-testid={`option-select-${id}`}
      >
        <span className="truncate">{value ? (selectedLabel ?? value) : placeholder}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && listboxId
        ? createPortal(
            <OptionList
              listboxId={listboxId}
              triggerId={id}
              listboxRef={dropdownRef}
              style={dropdownStyle}
              options={options}
              highlight={highlight}
              value={value}
              onHighlight={setHighlight}
              onCommit={commit}
            />,
            document.body,
          )
        : null}
    </>
  );
}

/* Portal listbox of `OptionSelect` — extracted to keep the parent's
   cognitive budget for the keyboard contract alone. */
interface OptionListProps {
  listboxId: string;
  triggerId?: string;
  listboxRef: React.RefObject<HTMLDivElement | null>;
  style: React.CSSProperties;
  options: readonly { value: string; label: string }[];
  highlight: number;
  value: string;
  onHighlight: (index: number) => void;
  onCommit: (value: string) => void;
}

function OptionList({
  listboxId,
  triggerId,
  listboxRef,
  style,
  options,
  highlight,
  value,
  onHighlight,
  onCommit,
}: OptionListProps) {
  return (
    <div
      ref={listboxRef}
      id={listboxId}
      role="listbox"
      aria-labelledby={triggerId}
      style={style}
      className="glass-panel fixed rounded-lg border border-border/70 p-1.5"
      data-testid={`option-select-listbox-${triggerId}`}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          id={triggerId ? `${triggerId}-option-${option.value}` : undefined}
          role="option"
          aria-selected={option.value === value}
          onMouseEnter={() => onHighlight(index)}
          onClick={() => onCommit(option.value)}
          className={cn(
            'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors',
            index === highlight
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:bg-secondary/50',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
