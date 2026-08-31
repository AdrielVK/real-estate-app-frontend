/**
 * Shared form primitives for the admin property-create form.
 *
 * Why these live in `create/form-fields.tsx` (not `src/components/ui/`)?
 * - Design decision: single consumer (the create form and its sections),
 *   so they stay local to the feature — the LoginForm precedent. A
 *   `ui/` primitive would imply a second consumer that does not exist
 *   yet, and Knip would (correctly) flag the dead export surface.
 *
 * Why raw `<input>`/`<select>` children instead of a controlled
 * `Field` that renders the control itself?
 * - The design pins "raw inputs with token class constants + local
 *   Field/FieldError". Sections own the control element (type, value,
 *   onChange, inputMode); `Field` owns the label association, the
 *   `id`/`name` wiring, and the ARIA error contract. `cloneElement`
 *   is the seam that keeps both halves declarative without a
 *   render-prop.
 *
 * Accessibility contract (spec "Design Tokens & A11y"):
 * - Every control gets an `id`; the `<label htmlFor>` matches it.
 * - Error state → `aria-invalid="true"` + `aria-describedby` pointing
 *   at the inline message, so assistive tech announces the reason.
 * - Hint (no error) → `aria-describedby` points at the hint instead,
 *   so the guidance is still attached to the control.
 *
 * Token discipline (spec NFR "Design Token Compliance"):
 * - `border-input`, `bg-background/40`, `text-muted-foreground`,
 *   `text-destructive` via the shared constants below — no hex.
 *   `aria-invalid:border-destructive` styles the error border off the
 *   ARIA attribute itself, so visuals and semantics can never drift.
 */

import { cloneElement, type ReactElement, type ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* Token class constants — the single styling source for the create form.     */
/* -------------------------------------------------------------------------- */

/**
 * Shared control classes for raw `<input>` and native `<select>`
 * elements. Mirrors the LoginForm input treatment (height, radius,
 * focus ring) so the create form reads as the same product surface.
 */
export const CONTROL_CLASSES =
  'h-11 w-full rounded-xl border border-input bg-background/40 px-3 text-sm outline-none transition aria-invalid:border-destructive focus-visible:ring-3 focus-visible:ring-ring/50';

/** Label treatment — same as LoginForm's `text-sm font-medium`. */
export const LABEL_CLASSES = 'text-sm font-medium';

/** Inline field-error copy — destructive token, never hex. */
export const ERROR_CLASSES = 'text-sm text-destructive';

/** Optional hint copy — muted token. */
export const HINT_CLASSES = 'text-xs text-muted-foreground';

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
  children: ReactElement;
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
