/**
 * Component tests for `LoginForm` — the client-side interactive
 * boundary extracted from the inline `<form>` block of
 * `src/app/(public)/login/page.tsx`.
 *
 * Why these tests exist:
 * - The spec mandates a single client-side UX gate (`areCredentialsValid`)
 *   that must short-circuit before any network call. That gate is a
 *   pure-function mirror of the server action's re-validation, so the
 *   component tests pin the contract end-to-end (mocked action +
 *   jsdom form submission).
 * - The error region has accessibility, layout-stability, and lifetime
 *   requirements (`aria-live="polite"`, reserved `min-h-*`, clear on
 *   typing, auto-clear after 5s with cleanup). These are component
 *   concerns, not server-action concerns, so they live here.
 *
 * The action module is mocked at the import boundary so:
 * - The gate can be verified by asserting `loginAction` is NEVER called
 *   for invalid input (the gate's only contract).
 * - The pending state can be observed by holding the action's promise
 *   open and inspecting the button.
 *
 * The mocked action is reset between cases and resolves to a clean
 * state (`{ error: null }`) by default — that matches the production
 * redirect-on-success flow (the cookie+redirect path is owned by the
 * action itself, not the form).
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loginAction } from '@/lib/auth/actions';
import { GENERIC_LOGIN_ERROR } from '@/lib/auth/validation';

import { LoginForm } from '@/app/(public)/login/_components/LoginForm';

vi.mock('@/lib/auth/actions', () => ({
  loginAction: vi.fn(),
}));

const mockLoginAction = vi.mocked(loginAction);

const VALID_EMAIL = 'user@domain.com';
const VALID_PASSWORD = 'Abcdef1!';

function setupUser(advanceTimers?: (ms: number) => Promise<void> | void) {
  // `delay: null` removes userEvent's per-keystroke delay so the test
  // doesn't depend on real timers firing. Combined with `advanceTimers`
  // for the fake-timer cases, this keeps every user operation
  // synchronous and deterministic.
  const options: Parameters<typeof userEvent.setup>[0] = { delay: null };
  if (advanceTimers) {
    options.advanceTimers = advanceTimers as never;
  }
  return userEvent.setup(options);
}

describe('LoginForm', () => {
  beforeEach(() => {
    mockLoginAction.mockReset();
    // Default: the action resolves cleanly. Specific cases override with
    // controlled promises or rejection when they need to inspect pending
    // state or simulate server-returned errors.
    mockLoginAction.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('client UX gate (mirrors areCredentialsValid)', () => {
    it('blocks the server action when email is invalid and surfaces the generic error', async () => {
      const user = setupUser();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'not-an-email');
      await user.type(screen.getByLabelText('Contraseña'), VALID_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));

      expect(mockLoginAction).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent(GENERIC_LOGIN_ERROR);
    });

    it('blocks the server action when password is invalid and surfaces the generic error', async () => {
      const user = setupUser();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), VALID_EMAIL);
      await user.type(screen.getByLabelText('Contraseña'), 'weak');
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));

      expect(mockLoginAction).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent(GENERIC_LOGIN_ERROR);
    });

    it('forwards valid credentials to the server action when the gate passes', async () => {
      const user = setupUser();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), VALID_EMAIL);
      await user.type(screen.getByLabelText('Contraseña'), VALID_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));

      expect(mockLoginAction).toHaveBeenCalledTimes(1);
      const [prevState, formData] = mockLoginAction.mock.calls[0] as [
        { error: string | null },
        FormData,
      ];
      expect(prevState).toEqual({ error: null });
      expect(formData.get('email')).toBe(VALID_EMAIL);
      expect(formData.get('password')).toBe(VALID_PASSWORD);
    });
  });

  describe('accessible reserved-space error region', () => {
    it('renders an aria-live="polite" status region with reserved vertical space', () => {
      render(<LoginForm />);

      const status = screen.getByRole('status');

      expect(status).toHaveAttribute('aria-live', 'polite');
      // Reserved vertical space — `min-h-*` keeps the layout stable so
      // appearing/disappearing error text never shifts the submit button.
      expect(status.className).toMatch(/\bmin-h-/);
    });

    it('shows ONLY the shared generic error text (never field-specific or backend reasons)', async () => {
      const user = setupUser();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'not-an-email');
      await user.type(screen.getByLabelText('Contraseña'), VALID_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));

      // The status region carries only the constant.
      expect(screen.getByRole('status')).toHaveTextContent(GENERIC_LOGIN_ERROR);
      // No field-level copy leaks into the visible region (the labels
      // themselves are still in the DOM, but not inside the status).
      const status = screen.getByRole('status');
      expect(status.textContent).not.toMatch(/email/i);
      expect(status.textContent).not.toMatch(/contraseña/i);
    });
  });

  describe('clear-on-input', () => {
    it('clears the visible error immediately when the user types in the email field', async () => {
      const user = setupUser();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'not-an-email');
      await user.type(screen.getByLabelText('Contraseña'), VALID_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));
      expect(screen.getByRole('status')).toHaveTextContent(GENERIC_LOGIN_ERROR);

      // Any keystroke in either field clears the error immediately.
      await user.type(screen.getByLabelText('Email'), 'x');

      expect(screen.getByRole('status')).toHaveTextContent('');
    });

    it('clears the visible error immediately when the user types in the password field', async () => {
      const user = setupUser();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'not-an-email');
      await user.type(screen.getByLabelText('Contraseña'), VALID_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));
      expect(screen.getByRole('status')).toHaveTextContent(GENERIC_LOGIN_ERROR);

      // Typing in the password field also clears the error.
      await user.type(screen.getByLabelText('Contraseña'), 'y');

      expect(screen.getByRole('status')).toHaveTextContent('');
    });
  });

  describe('auto-clear after 5 seconds', () => {
    // The timer tests deliberately bypass `userEvent` (which schedules
    // internal timers that fight vitest's fake timers) and drive the
    // form via `fireEvent` instead. The component-level behavior we
    // exercise here is `useEffect` setup + cleanup + the `setTimeout`
    // window — none of those depend on userEvent's keystroke model.

    it('clears the error after ~5 seconds of no typing (timer cleanup)', async () => {
      vi.useFakeTimers();
      render(<LoginForm />);

      const email = screen.getByLabelText('Email') as HTMLInputElement;
      const password = screen.getByLabelText('Contraseña') as HTMLInputElement;
      const submitBtn = screen.getByRole('button', { name: 'Ingresar' });

      fireEvent.change(email, { target: { value: 'not-an-email' } });
      fireEvent.change(password, { target: { value: VALID_PASSWORD } });
      act(() => {
        fireEvent.click(submitBtn);
      });
      expect(screen.getByRole('status')).toHaveTextContent(GENERIC_LOGIN_ERROR);

      // Just before the threshold — still visible.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4999);
      });
      expect(screen.getByRole('status')).toHaveTextContent(GENERIC_LOGIN_ERROR);

      // Crossing the 5-second boundary — cleared.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.getByRole('status')).toHaveTextContent('');
    });

    it('cancels the previous timer when a fresh error appears (useEffect cleanup)', async () => {
      vi.useFakeTimers();
      render(<LoginForm />);

      const email = screen.getByLabelText('Email') as HTMLInputElement;
      const password = screen.getByLabelText('Contraseña') as HTMLInputElement;
      const submitBtn = screen.getByRole('button', { name: 'Ingresar' });

      // Trigger the first error.
      fireEvent.change(email, { target: { value: 'not-an-email' } });
      fireEvent.change(password, { target: { value: VALID_PASSWORD } });
      act(() => {
        fireEvent.click(submitBtn);
      });
      expect(screen.getByRole('status')).toHaveTextContent(GENERIC_LOGIN_ERROR);

      // Advance 3s — the first timer is mid-flight.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(screen.getByRole('status')).toHaveTextContent(GENERIC_LOGIN_ERROR);

      // Trigger the clear-on-input path: typing in either field
      // immediately empties the status region.
      fireEvent.change(email, { target: { value: 'not-an-email@' } });
      expect(screen.getByRole('status')).toHaveTextContent('');

      // Re-trigger the error path with a still-invalid value. The
      // useEffect dependency on `localError` fires the cleanup, which
      // cancels the in-flight 5s timer from the first error and starts
      // a fresh one.
      fireEvent.change(email, { target: { value: 'still-invalid' } });
      act(() => {
        fireEvent.click(submitBtn);
      });
      expect(screen.getByRole('status')).toHaveTextContent(GENERIC_LOGIN_ERROR);

      // Advance another 3s — only 3s after the second error, so still
      // visible. If the first timer had NOT been canceled, it would
      // also fire around now and clear the error prematurely.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(screen.getByRole('status')).toHaveTextContent(GENERIC_LOGIN_ERROR);

      // Cross the second 5s boundary — fresh timer fires.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(screen.getByRole('status')).toHaveTextContent('');
    });
  });

  describe('preserved input attributes', () => {
    it('preserves the exact input ids, names, labels, types, autocomplete, and required attributes', () => {
      render(<LoginForm />);

      const email = screen.getByLabelText('Email');
      expect(email).toHaveAttribute('id', 'email');
      expect(email).toHaveAttribute('name', 'email');
      expect(email).toHaveAttribute('type', 'email');
      expect(email).toHaveAttribute('autoComplete', 'email');
      expect(email).toBeRequired();

      const password = screen.getByLabelText('Contraseña');
      expect(password).toHaveAttribute('id', 'password');
      expect(password).toHaveAttribute('name', 'password');
      expect(password).toHaveAttribute('type', 'password');
      expect(password).toHaveAttribute('autoComplete', 'current-password');
      expect(password).toBeRequired();
    });
  });

  describe('submit button', () => {
    it('renders the submit button accessible and pointer-enabled by default', () => {
      render(<LoginForm />);

      const button = screen.getByRole('button', { name: 'Ingresar' });
      expect(button).toHaveAttribute('type', 'submit');
      expect(button).toBeEnabled();
      // Pointer-enabled — the Button primitive's base class keeps
      // `cursor-pointer` unless disabled.
      expect(button.className).toMatch(/cursor-pointer/);
    });

    it('disables the submit button while the server action is pending', async () => {
      let resolveAction!: (value: { error: string | null }) => void;
      mockLoginAction.mockImplementationOnce(
        () =>
          new Promise<{ error: string | null }>((resolve) => {
            resolveAction = resolve;
          }),
      );

      const user = setupUser();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), VALID_EMAIL);
      await user.type(screen.getByLabelText('Contraseña'), VALID_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));

      // The button must reflect `isPending` without changing the layout.
      // Disabled buttons retain the same class footprint in the Button
      // primitive (`disabled:pointer-events-none disabled:opacity-50`),
      // so DOM order, parent grid, and surrounding regions are stable.
      const button = screen.getByRole('button', { name: /ingres/i });
      expect(button).toBeDisabled();

      // Resolve the pending action so the test cleans up.
      await act(async () => {
        resolveAction({ error: null });
      });
    });
  });

  describe('progressive enhancement', () => {
    it('forwards valid credentials through the server action (no client-side branching)', async () => {
      const user = setupUser();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), VALID_EMAIL);
      await user.type(screen.getByLabelText('Contraseña'), VALID_PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));

      // The gate is the only client-side branch; success path is a
      // straight pass-through to the server action. The action itself
      // owns the cookie + redirect path — this assertion only proves
      // the form invoked it with the user's typed credentials.
      expect(mockLoginAction).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('status')).toHaveTextContent('');
    });
  });
});
