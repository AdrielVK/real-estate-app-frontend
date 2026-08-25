/**
 * Component tests for `UserBlock` — the admin-zone identity strip that
 * lives in the Sidebar footer and the MobileNav drawer.
 *
 * Why these tests exist:
 * - `UserBlock` is the visible bridge between the server-resolved
 *   `AdminUser` and the client chrome. It renders `displayName` (or
 *   a `null` fallback) and the role badge.
 * - The component is intentionally presentational — no hooks, no
 *   cookies, no routing — so the tests pin the visible contract:
 *   role badge text, display-name text, and the null fallback.
 *
 * Behavior pinned:
 * 1. Renders the role badge with the exact role literal (e.g. "ADMIN").
 * 2. Renders the `displayName` when present.
 * 3. Falls back gracefully when `displayName` is `null` — no crash,
 *    role badge still renders, and no "null" string leaks to the UI.
 * 4. Exposes a stable `data-testid` so layout tests can target it.
 * 5. Uses a semantic `<div>` (not a `<button>`) — it is not interactive.
 */
import { render, screen } from '@testing-library/react';

import { UserBlock } from '@/components/admin/UserBlock';

describe('UserBlock', () => {
  it('renders the role badge with the exact role literal', () => {
    render(<UserBlock displayName="Ana" userRole="ADMIN" />);
    expect(screen.getByTestId('user-block-role')).toHaveTextContent('ADMIN');
  });

  it('renders the displayName when present', () => {
    render(<UserBlock displayName="Ana" userRole="AGENT" />);
    expect(screen.getByTestId('user-block-name')).toHaveTextContent('Ana');
  });

  it('falls back gracefully when displayName is null — role still renders', () => {
    render(<UserBlock displayName={null} userRole="ADMINISTRATIVE" />);
    expect(screen.getByTestId('user-block-name')).toBeInTheDocument();
    expect(screen.getByTestId('user-block-name')).toBeEmptyDOMElement();
    expect(screen.getByTestId('user-block-role')).toHaveTextContent('ADMINISTRATIVE');
  });

  it('exposes a stable data-testid root for layout tests', () => {
    render(<UserBlock displayName="Ana" userRole="ADMIN" />);
    expect(screen.getByTestId('user-block')).toBeInTheDocument();
  });

  it('is presentational — not a button or interactive element', () => {
    const { container } = render(<UserBlock displayName="Ana" userRole="ADMIN" />);
    const root = screen.getByTestId('user-block');
    expect(root.tagName).toBe('DIV');
    expect(container.querySelector('button')).toBeNull();
  });
});
