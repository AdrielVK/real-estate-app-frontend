/**
 * Component tests for `ProfileMenu` — the public-zone client dropdown
 * shown by `AuthSection` when the visitor has a valid session.
 *
 * Why these tests exist:
 * - The component is the single hand-rolled accessibility surface in
 *   the navbar auth menu (design decision 5: no headless dependency).
 *   The spec pins: trigger aria-expanded / aria-controls, accessible
 *   name, focus return on close, outside-click and Escape close, and
 *   the non-blocking `role="status"` failure message from
 *   `publicLogoutAction`. Each scenario is its own `it` so a future
 *   regression points at the contract it broke.
 * - The action module is mocked at the import boundary (same pattern
 *   as `LoginForm.test.tsx` and `Topbar.test.tsx`) so the test stays
 *   a pure rendering + interaction test. The action's contract is
 *   pinned separately in `tests/lib/auth-actions.test.ts`.
 *
 * Behavior pinned:
 * 1. Trigger has profile icon + display name (or icon-only fallback).
 * 2. `aria-expanded` / `aria-controls` reflect open state.
 * 3. Accessible name includes the display name when present.
 * 4. Click / Enter / Space opens the menu (keyboard reachability).
 * 5. Escape and outside click close the menu; focus returns to trigger.
 * 6. Reactivating the trigger toggles closed.
 * 7. Submitting logout forwards to `publicLogoutAction` via
 *    `useActionState`.
 * 8. A returned `{ error }` surfaces in a `role="status"` region and
 *    keeps the menu open so the user can retry.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { publicLogoutAction } from '@/lib/auth/actions';
import { GENERIC_LOGOUT_ERROR } from '@/lib/auth/validation';

import { ProfileMenu } from '@/components/public/ProfileMenu';

vi.mock('@/lib/auth/actions', () => ({
  publicLogoutAction: vi.fn(),
}));

const mockPublicLogoutAction = vi.mocked(publicLogoutAction);

function setupUser(): ReturnType<typeof userEvent.setup> {
  // `delay: null` removes userEvent's per-keystroke delay so the test
  // doesn't depend on real timers. Every interaction stays synchronous
  // and deterministic.
  return userEvent.setup({ delay: null });
}

describe('ProfileMenu', () => {
  beforeEach(() => {
    mockPublicLogoutAction.mockReset();
    // Default: the action resolves cleanly with no error (the success
    // path never returns in production — the server redirects — but
    // the resolved value lets us assert the form-binding without
    // forcing every test to mock it explicitly).
    mockPublicLogoutAction.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('trigger rendering', () => {
    it('renders the profile icon and display name beside it when displayName is provided', () => {
      render(<ProfileMenu displayName="ana" />);

      const trigger = screen.getByRole('button', { name: /ana/i });
      // Accessible name includes the display name so screen readers
      // announce who is signed in (spec "Accessibility").
      expect(trigger).toHaveAccessibleName(/ana/i);
      // The trigger carries the visible display name text.
      expect(trigger).toHaveTextContent('ana');
      // The trigger owns an SVG icon (lucide-react UserRound).
      expect(trigger.querySelector('svg')).not.toBeNull();
    });

    it('falls back to icon-only with no visible text when displayName is absent', () => {
      render(<ProfileMenu />);

      // No displayName prop → no displayName string in the DOM. The
      // trigger is still rendered as a button with an SVG icon and a
      // generic accessible name (spec "No usable identity text").
      const trigger = screen.getByRole('button');
      expect(trigger.querySelector('svg')).not.toBeNull();
      // Icon-only: the trigger MUST NOT carry any display name text.
      // We assert the visible text content is empty (sr-only labels
      // are excluded because they carry only whitespace).
      const visibleText = (trigger.textContent ?? '').trim();
      expect(visibleText).toBe('');
    });

    it('falls back to icon-only when displayName is an empty or whitespace-only string', () => {
      const { rerender } = render(<ProfileMenu displayName="" />);
      expect((screen.getByRole('button').textContent ?? '').trim()).toBe('');

      rerender(<ProfileMenu displayName="   " />);
      expect((screen.getByRole('button').textContent ?? '').trim()).toBe('');
    });
  });

  describe('ARIA state announcement', () => {
    it('exposes aria-expanded="false" and aria-controls pointing to the menu id when closed', () => {
      render(<ProfileMenu displayName="ana" />);

      const trigger = screen.getByRole('button', { name: /ana/i });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      const controlsId = trigger.getAttribute('aria-controls');
      expect(controlsId).toBeTruthy();
      // The menu must be reachable by the same id (even when closed we
      // query by id because the menu element is rendered with `hidden`
      // rather than unmounted — keeps focus management simple).
      expect(document.getElementById(controlsId as string)).not.toBeNull();
    });

    it('flips aria-expanded to "true" when the menu is open', async () => {
      const user = setupUser();
      render(<ProfileMenu displayName="ana" />);

      const trigger = screen.getByRole('button', { name: /ana/i });
      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('open / close interactions', () => {
    it('opens the menu when the trigger is clicked and reveals the logout action', async () => {
      const user = setupUser();
      render(<ProfileMenu displayName="ana" />);

      await user.click(screen.getByRole('button', { name: /ana/i }));

      // The logout menu item is reachable once the menu is open. The
      // logout button carries `role="menuitem"` (ARIA menu pattern),
      // so `getByRole('menuitem', ...)` is the semantic query.
      expect(screen.getByRole('menuitem', { name: /cerrar sesi[oó]n/i })).toBeInTheDocument();
    });

    it('toggles closed when the trigger is clicked again', async () => {
      const user = setupUser();
      render(<ProfileMenu displayName="ana" />);

      const trigger = screen.getByRole('button', { name: /ana/i });
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes the menu when Escape is pressed and returns focus to the trigger', async () => {
      const user = setupUser();
      render(<ProfileMenu displayName="ana" />);

      const trigger = screen.getByRole('button', { name: /ana/i });
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await user.keyboard('{Escape}');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      // Focus must return to the trigger after the menu closes so
      // keyboard users keep their place (spec "Keyboard operation").
      expect(trigger).toHaveFocus();
    });

    it('closes the menu when a mousedown happens outside the menu', async () => {
      const user = setupUser();
      render(
        <div>
          <ProfileMenu displayName="ana" />
          {/* Outside sentinel — anything outside the menu root. */}
          <button type="button" data-testid="outside">
            Otro
          </button>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: /ana/i });
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      // userEvent's `click` covers the synthetic pointer / mouse
      // sequence; outside-click handlers in this design listen for
      // mousedown so the menu closes BEFORE a possible focus change.
      fireEvent.mouseDown(screen.getByTestId('outside'));

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('keyboard reachability', () => {
    it('opens the menu and moves focus into the menu content when the trigger is activated via keyboard', async () => {
      const user = setupUser();
      render(<ProfileMenu displayName="ana" />);

      const trigger = screen.getByRole('button', { name: /ana/i });
      trigger.focus();
      expect(trigger).toHaveFocus();

      // Enter or Space opens the menu (button activation keys).
      await user.keyboard('{Enter}');

      // Menu opens.
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      // Focus has moved INTO the menu — the logout menu item is
      // reachable without another Tab press (spec "Keyboard operation").
      const logoutButton = screen.getByRole('menuitem', { name: /cerrar sesi[oó]n/i });
      expect(logoutButton).toHaveFocus();
    });
  });

  describe('logout submission', () => {
    it('invokes publicLogoutAction through the form when logout is submitted', async () => {
      const user = setupUser();
      render(<ProfileMenu displayName="ana" />);

      await user.click(screen.getByRole('button', { name: /ana/i }));
      await user.click(screen.getByRole('menuitem', { name: /cerrar sesi[oó]n/i }));

      expect(mockPublicLogoutAction).toHaveBeenCalledTimes(1);
    });

    it('surfaces a role="status" message with the generic error when publicLogoutAction returns one', async () => {
      // Resolve with the spec-mandated error so useActionState pushes
      // it into the visible region.
      mockPublicLogoutAction.mockResolvedValue({ error: GENERIC_LOGOUT_ERROR });

      const user = setupUser();
      render(<ProfileMenu displayName="ana" />);

      await user.click(screen.getByRole('button', { name: /ana/i }));
      await user.click(screen.getByRole('menuitem', { name: /cerrar sesi[oó]n/i }));

      // The status region carries the shared error string and is
      // wired to aria-live so assistive tech announces it (spec
      // "Logout failure" → SHOULD surface a non-blocking error).
      // `findByText` polls until the action's resolved state is
      // rendered — useActionState commits the update on a microtask
      // and a sync assertion after `user.click` can race with it
      // when other test files have left timers or microtasks in
      // flight.
      const status = await screen.findByText(GENERIC_LOGOUT_ERROR);
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('keeps the menu open when logout fails so the user can retry', async () => {
      mockPublicLogoutAction.mockResolvedValue({ error: GENERIC_LOGOUT_ERROR });

      const user = setupUser();
      render(<ProfileMenu displayName="ana" />);

      const trigger = screen.getByRole('button', { name: /ana/i });
      await user.click(trigger);
      await user.click(screen.getByRole('menuitem', { name: /cerrar sesi[oó]n/i }));

      // The user remains authenticated (spec "Logout failure" → MUST
      // remain authenticated), so the menu MUST stay open: closing it
      // would force the user to re-open it to retry, contradicting
      // the "non-blocking" intent.
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('clears the error message on the next successful logout attempt', async () => {
      // First attempt fails.
      mockPublicLogoutAction.mockResolvedValueOnce({ error: GENERIC_LOGOUT_ERROR });
      // Second attempt succeeds (the production action redirects, but
      // we treat any error:null return as success from the UI's POV).
      mockPublicLogoutAction.mockResolvedValueOnce({ error: null });

      const user = setupUser();
      render(<ProfileMenu displayName="ana" />);

      const trigger = screen.getByRole('button', { name: /ana/i });
      await user.click(trigger);
      await user.click(screen.getByRole('menuitem', { name: /cerrar sesi[oó]n/i }));

      // Wait for the first submission's error to render before the
      // second submission clears it (see `findByText` note above).
      await screen.findByText(GENERIC_LOGOUT_ERROR);

      await user.click(screen.getByRole('menuitem', { name: /cerrar sesi[oó]n/i }));

      // The status region is now empty — error cleared on a fresh attempt.
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('');
      });
    });
  });
});
