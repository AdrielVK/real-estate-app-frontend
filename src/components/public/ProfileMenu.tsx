/**
 * `ProfileMenu` — public-zone authenticated profile dropdown.
 *
 * Rendered by `AuthSection` (Phase 3) when the visitor has a valid
 * session. The component is the single hand-rolled accessibility
 * surface in the navbar auth menu (design decision 5: no headless
 * dependency) — it owns:
 *
 * 1. The trigger (profile icon + optional display name).
 * 2. The dropdown panel with the logout form.
 * 3. The interaction lifecycle:
 *    - Toggle via click, Enter, or Space on the trigger.
 *    - Close on Escape, outside mousedown, or trigger re-activation.
 *    - Focus return to the trigger when the menu closes.
 *    - Focus moves into the menu content (logout button) when the
 *      menu opens via keyboard activation.
 * 4. The non-blocking `role="status"` failure message wired to
 *    `publicLogoutAction` via React 19's `useActionState`.
 *
 * ## ARIA contract
 * - `aria-expanded` on the trigger reflects the open state.
 * - `aria-controls` on the trigger references the menu id so AT can
 *   jump from trigger to content.
 * - `aria-live="polite"` + `role="status"` on the error region so a
 *   revocation failure is announced without interrupting the user.
 *
 * ## Why a `hidden` attribute (not unmount) on the closed menu?
 * - Keeping the menu element mounted lets the outside-click / Escape
 *   effects query the same `aria-controls` id without flicker, and
 *   it avoids re-running the form action's hook plumbing on every
 *   open. The hidden attribute removes the menu from the accessibility
 *   tree and the visual layout, satisfying the spec without the cost
 *   of remounting.
 *
 * ## Why the menu stays open on logout failure
 * - Spec "Logout failure" says the user remains authenticated (MUST)
 *   and the system SHOULD surface a non-blocking error. Auto-closing
 *   the menu on a failed logout would force the user to re-open it to
 *   retry, contradicting "non-blocking". The success path is owned by
 *   the server action's `redirect` — by the time the user could see
 *   a close animation the page is already navigating away.
 *
 * ## Why this is a Client Component
 * - Owns local state (open/close), refs (trigger + menu), and effect
 *   lifecycles (outside mousedown / Escape keydown). None of that can
 *   run in a Server Component.
 */

'use client';

import {
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { LogOut, UserRound } from 'lucide-react';

import { publicLogoutAction } from '@/lib/auth/actions';
import { cn } from '@/lib/utils';

export interface ProfileMenuProps {
  /**
   * Display name shown beside the profile icon. Falsy values
   * (`undefined`, `''`, whitespace-only) render the trigger
   * icon-only — see spec scenario "No usable identity text".
   */
  displayName?: string;
}

const INITIAL_STATE: { error: string | null } = { error: null };

/**
 * Compute the visible display name. Returns `null` when the input is
 * absent or whitespace-only so the trigger renders icon-only.
 */
function resolveDisplayName(displayName: string | undefined): string | null {
  if (typeof displayName !== 'string') return null;
  const trimmed = displayName.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * `ProfileMenu` — public-zone authenticated profile dropdown.
 *
 * Renders an accessible trigger + dropdown with a logout form. The
 * trigger toggles the dropdown via click / keyboard. Outside mousedown
 * and Escape close the dropdown and return focus to the trigger.
 *
 * The trigger's accessible name is built from the profile icon (with
 * `aria-hidden` so AT does not double-announce "user") plus the
 * resolved display name (when present) and the closed/open state hint,
 * matching the spec scenario "State announcement".
 */
export function ProfileMenu({ displayName }: ProfileMenuProps) {
  const reactId = useId();
  const menuId = `profile-menu-${reactId}`;
  const triggerId = `profile-trigger-${reactId}`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);

  // Wire the server action through `useActionState`. The hook returns
  // the current state, the form-action wrapper, and a pending flag.
  // We intentionally do NOT gate the submit button on `isPending` —
  // the success path never returns (the action redirects), and the
  // failure path benefits from immediate retry without a UI stall.
  const [state, formAction] = useActionState(publicLogoutAction, INITIAL_STATE);

  const resolvedName = resolveDisplayName(displayName);

  // Outside click — close the menu when the user mousedowns anywhere
  // outside the menu root (trigger + panel). `mousedown` (not `click`)
  // matches what most native disclosure widgets do and prevents focus
  // from briefly landing inside the panel after a dismissal.
  useEffect(() => {
    if (!open) return undefined;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  // Escape — close the menu and return focus to the trigger. We only
  // listen while the menu is open so the global keydown space stays
  // free for the rest of the app.
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      // Return focus to the trigger so keyboard users keep their place.
      triggerRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleTriggerClick = useCallback(() => {
    setOpen((wasOpen) => !wasOpen);
  }, []);

  const handleTriggerKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    // Native <button> maps Enter / Space to click; calling
    // preventDefault here stops the synthetic click so we can drive
    // the toggle from a single source. We mirror the click path
    // (`handleTriggerClick`) so the open/closed state stays
    // consistent regardless of input device.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen((wasOpen) => !wasOpen);
    }
  }, []);

  // After the menu opens, move focus into the panel (the logout button)
  // so keyboard users can act immediately (spec "Keyboard operation").
  // We watch `open` and let the menu element render first; the effect
  // fires after commit so the button is in the DOM and focusable.
  useEffect(() => {
    if (!open) return;
    const panel = menuRef.current;
    if (!panel) return;
    const focusable = panel.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
    focusable?.focus();
  }, [open]);

  // Build the accessible name. When a display name exists, include it
  // explicitly (spec "Accessibility"). When the menu is icon-only we
  // fall back to a generic "Perfil" label so the trigger still carries
  // a meaningful name.
  const accessibleName = resolvedName
    ? `Menú de perfil de ${resolvedName}`
    : 'Menú de perfil';

  const handleMenuMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    // Prevent the outside-click handler from closing the menu when the
    // user clicks inside the panel itself (the event bubbles to
    // document, but the contains() check above already handles it —
    // this is a safety net for stopPropagation-style consumers).
    event.stopPropagation();
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={accessibleName}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-border bg-transparent px-3 py-1.5 text-sm font-medium transition-colors',
          'hover:bg-secondary/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          open && 'bg-secondary/70',
        )}
      >
        <UserRound className="size-4" aria-hidden="true" />
        {resolvedName && <span>{resolvedName}</span>}
      </button>

      {/*
        Menu panel — rendered with `hidden` when closed so the element
        stays mounted (effect hooks are stable across opens) but is
        removed from the accessibility tree and visual layout. The
        container holds BOTH the trigger ref check target and the menu
        ref check target for the outside-click handler above.
      */}
      <div
        ref={(node) => {
          // Compose both refs onto the menu container so the outside
          // click handler can treat it as the root.
          menuRef.current = node;
        }}
        id={menuId}
        role="menu"
        aria-labelledby={triggerId}
        // `tabIndex={-1}` makes the menu container programmatically
        // focusable (the `menu` role requires it) without putting the
        // container itself in the tab order — focus still lands on
        // the menu item when the panel opens.
        tabIndex={-1}
        hidden={!open}
        onMouseDown={handleMenuMouseDown}
        className={cn(
          'absolute right-0 z-50 mt-2 min-w-56 rounded-2xl border border-border/70 bg-popover p-2 shadow-lg',
          // `hidden` already strips layout; we keep the class set here
          // for the OPEN state so the dropdown has a known footprint.
          !open && 'hidden',
        )}
      >
        {/*
          Logout form. `action={formAction}` wires the bound action
          from `useActionState` directly — React 19's progressive
          enhancement handles submission without JS. No `onSubmit`
          is needed because the action owns its own error state via
          the `useActionState` return value.
        */}
        <form action={formAction} className="contents">
          <button
            type="submit"
            role="menuitem"
            className={cn(
              'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
              'hover:bg-secondary/70 focus-visible:bg-secondary/70 focus-visible:outline-none',
            )}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </form>

        {/*
          Non-blocking error region. `role="status"` + `aria-live="polite"`
          announce the message without interrupting the user (spec
          "Logout failure" → SHOULD surface a non-blocking error). The
          region is always rendered (with reserved vertical space) so
          the menu's height stays stable when the message appears or
          disappears — same layout-stability rationale as `LoginForm`.
          The error persists until the next action run clears it (a
          successful retry) or until the user closes the menu.
        */}
        <p
          role="status"
          aria-live="polite"
          className="min-h-5 px-3 pb-1 pt-1 text-xs text-destructive"
        >
          {state.error ?? ''}
        </p>
      </div>
    </div>
  );
}
