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

import { cloneElement, type ReactElement, type ReactNode } from 'react';

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
  'h-11 min-h-[44px] w-full rounded-xl border border-input bg-background/40 px-3 text-[16px] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/60 aria-invalid:border-destructive focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:text-sm';

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
  children,
  className,
}: SectionShellProps) {
  return (
    <fieldset
      className={cn(
        'group/section relative grid gap-5 overflow-hidden rounded-2xl border bg-card/50 p-4 shadow-[0_1px_2px_color-mix(in_oklch,var(--border)_60%,transparent)] transition-[border-color,background-color,box-shadow] duration-200 sm:p-5',
        'border-l-[3px]',
        hasError
          ? 'border-border border-l-destructive bg-destructive/[0.04] focus-within:border-l-destructive'
          : 'border-border border-l-border focus-within:border-l-copper/60 focus-within:bg-copper/[0.04] focus-within:shadow-[0_8px_24px_-16px_color-mix(in_oklch,var(--primary)_30%,transparent)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p
            aria-hidden="true"
            className={cn(
              'font-mono text-[11px] font-medium uppercase tracking-[0.14em]',
              hasError ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {eyebrow}
          </p>
          <legend className="p-0 text-[15px] font-semibold leading-none tracking-tight">
            {title}
          </legend>
          {description ? (
            <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {hasError ? (
          <span className="inline-flex items-center rounded-full bg-destructive px-2.5 py-1 text-[11px] font-medium leading-none text-white">
            Revisar
          </span>
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

  let extra: ReactNode = null;
  if (error) {
    extra = <FieldError id={errorId} message={error} />;
  } else if (hint) {
    extra = (
      <p id={hintId} className={HINT_CLASSES}>
        {hint}
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className={LABEL_CLASSES}>
        {label}
      </label>
      {control}
      {extra}
    </div>
  );
}
