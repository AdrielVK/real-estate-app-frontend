import type { ReactNode } from 'react';

import { logoutAction } from '@/lib/auth/actions';

import { Sidebar } from '@/components/admin/Sidebar';
import { Topbar } from '@/components/admin/Topbar';

/**
 * `app/(admin)/admin/layout` — admin-zone shell.
 *
 * Structure (spec A2):
 * - Outer flex row pinned to the viewport (`h-screen`).
 *   - Sidebar on the left (w-64, portal tokens, hidden <lg).
 *   - Right column holds the Topbar and the scrollable content area.
 *     The inner `overflow-y-auto` on `<main>` is what makes the sidebar
 *     + topbar stay in place while the page content scrolls.
 *
 * The Sidebar is now prop-driven: `logoutAction` is threaded in as the
 * `onLogout` prop so the Sidebar is decoupled from the server-actions
 * module. The `user` prop is a placeholder `null` for now; commit 2
 * turns this layout into an async RSC wrapper that decodes the access
 * cookie via `resolveAdminUser` and pipes the real user here.
 *
 * Both the Sidebar and the Topbar are Server Components, so this layout
 * stays on the server and ships zero JS for the chrome.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar user={null} onLogout={logoutAction} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
