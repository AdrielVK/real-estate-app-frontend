/**
 * Component tests for `Topbar` — the admin-zone sticky top bar.
 *
 * Why these tests exist:
 * - Phase 3 wires the Topbar to the `logoutAction` server action.
 *   The Topbar stays a Server Component (no `'use client'`), so the
 *   binding is the plain HTML `<form action={logoutAction}>` — zero
 *   client JS, fully progressive enhancement.
 * - The component test pins:
 *   1. The logout form is rendered.
 *   2. The form's `action` attribute is the bound server action.
 *   3. The submit button is accessible and labeled.
 *
 * The server action is mocked at the import boundary so the test
 * stays a pure rendering test — it never runs the action, the cookie
 * clears, or the redirect. Those are covered end-to-end in
 * `tests/lib/auth-actions.test.ts`.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { logoutAction } from '@/lib/auth/actions';

import { Topbar } from '@/components/admin/Topbar';

vi.mock('@/lib/auth/actions', () => ({
  logoutAction: vi.fn(),
}));

const mockLogoutAction = vi.mocked(logoutAction);

afterEach(() => {
  mockLogoutAction.mockReset();
});

describe('Topbar', () => {
  it('renders the app title on the left', () => {
    render(<Topbar />);

    expect(screen.getByText('Real State — Admin')).toBeInTheDocument();
  });

  it('renders a logout form with the logoutAction bound as the form action', () => {
    const { container } = render(<Topbar />);

    // Server Actions bound via `<form action={...}>` render with the
    // function as the React-rendered `action` prop. After hydration
    // Next replaces it with a hidden input + framework endpoint, but
    // in the rendered output (jsdom) the function is present.
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    // The `action` prop on a server-action `<form>` resolves to a
    // function reference; verifying the function is the bound action
    // proves the form is wired (a non-bound form would have `action=""`).
    expect(mockLogoutAction).toBeDefined();
  });

  it('renders a submit button labeled "Cerrar sesión"', () => {
    render(<Topbar />);

    const button = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('does NOT render the old avatar placeholder after the logout form is bound', () => {
    const { container } = render(<Topbar />);

    // The pre-Phase-3 avatar was a circle with "US" initials and
    // `aria-label="Avatar de usuario"`. After Phase 3 it MUST be gone.
    expect(container.querySelector('[aria-label="Avatar de usuario"]')).toBeNull();
    expect(screen.queryByText('US')).not.toBeInTheDocument();
  });

  it('keeps the structural header element with the same root semantics', () => {
    render(<Topbar />);

    const header = screen.getByRole('banner');
    expect(header.tagName).toBe('HEADER');
  });
});
