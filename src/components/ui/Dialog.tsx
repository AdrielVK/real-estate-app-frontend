'use client';

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useRef,
} from 'react';

import { cn } from '@/lib/utils';

export interface DialogProps {
  /**
   * Whether the dialog is currently open. Controls the underlying
   * `<dialog>` element's `open` attribute via `showModal()` (real
   * browsers) or a property assignment (jsdom fallback — A5).
   */
  open: boolean;
  /**
   * Fired when the dialog wants to close — Escape key, backdrop click,
   * or a parent calling `onOpenChange(false)` after a successful action.
   * The parent OWNS the `open` state; this component never mutates it
   * directly to keep the data flow unidirectional.
   */
  onOpenChange: (open: boolean) => void;
  /**
   * `id` of the element labelling the dialog (typically the title's
   * heading). Forwarded to `aria-labelledby` for screen readers.
   */
  labelledBy?: string;
  /** Extra classes appended to the dialog surface. */
  className?: string;
  /** Dialog body — render whatever you want inside the glass panel. */
  children: ReactNode;
}

/**
 * `Dialog` — native `<dialog>` wrapper for modal surfaces.
 *
 * Design notes (A5, BUTTON-5 neighbor):
 * - NO radix or base-ui headless libraries — a single ~150-line file
 *   replaces the whole dependency tree and gives us a 0-byte runtime
 *   cost when closed.
 * - `showModal()` and `close()` are both feature-checked; in jsdom
 *   they fall back to setting the `open` property so unit tests can
 *   assert the attribute directly.
 * - Escape is handled in two places: the native `cancel` event (real
 *   browsers) AND an explicit `keydown` listener (jsdom + edge cases
 *   where the cancel event might be suppressed by an inner element).
 *   A ref guard prevents double-firing `onOpenChange(false)`.
 * - Backdrop click is implemented via `onMouseDown` checking
 *   `target === currentTarget` so clicks inside the content (including
 *   selection drags) don't dismiss the modal.
 */
export function Dialog({ open, onOpenChange, labelledBy, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);
  // Guard so the cancel event + keydown Escape can't double-fire
  // `onOpenChange(false)` back-to-back in the same tick.
  const closingRef = useRef(false);

  // Sync the `open` prop with the underlying <dialog> element.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          // jsdom 29+ ships the property/attribute but not the method.
          dialog.open = true;
        }
      }
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        // jsdom fallback — flips the reflected property, which removes
        // the `open` attribute the same way `close()` would.
        dialog.open = false;
      }
    }
  }, [open]);

  // Native browser: pressing Escape fires the `cancel` event AND removes
  // the `open` attribute (via `close()`). We just need to bubble that up
  // to the parent so it can update React state.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = () => {
      if (closingRef.current) return;
      closingRef.current = true;
      onOpenChange(false);
      // Release the guard on the next microtask so a future open/close
      // cycle can still notify the parent.
      queueMicrotask(() => {
        closingRef.current = false;
      });
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onOpenChange]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Escape') return;
    if (closingRef.current) return;
    closingRef.current = true;
    onOpenChange(false);
    queueMicrotask(() => {
      closingRef.current = false;
    });
  };

  const handleMouseDown = (event: ReactMouseEvent<HTMLDialogElement>) => {
    // Only the backdrop itself (the dialog element) triggers close —
    // clicks bubbling up from the content area are ignored so users
    // can select text / click inner controls without dismissing.
    if (event.target === event.currentTarget) {
      onOpenChange(false);
    }
  };

  return (
    // <dialog> is interactive by spec (focusable, Escape-dismissible,
    // modal when open). jsx-a11y v6 doesn't yet classify it as
    // interactive, so we suppress the false positive here only.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      aria-modal={open || undefined}
      aria-labelledby={labelledBy}
      // Inline style keeps the enter/exit transition self-contained
      // even if Tailwind utilities for `open:` aren't compiled in the
      // host app's layer graph.
      style={DIALOG_STYLE}
      className={cn(
        'glass-panel relative rounded-3xl border border-border/70 p-6',
        'max-w-lg w-[calc(100%-2rem)]',
        'backdrop:bg-black/50 backdrop:backdrop-blur-sm',
        'text-foreground',
        // Subtle entry animation: opacity + scale. The native dialog
        // is in the DOM immediately when `open` is true, so we just
        // animate the surface itself.
        'transition-[opacity,transform] duration-200',
        open ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        className,
      )}
    >
      {children}
    </dialog>
  );
}

// Inline style block — kept outside the render so React doesn't
// re-allocate a new object every render. `color` is set here to match
// the foreground token so default text inside the dialog is legible.
const DIALOG_STYLE: CSSProperties = {
  color: 'var(--foreground)',
  // `margin: auto` centers the dialog vertically/horizontally when shown
  // as modal. Without it, top-aligned dialogs look unbalanced.
  margin: 'auto',
};
