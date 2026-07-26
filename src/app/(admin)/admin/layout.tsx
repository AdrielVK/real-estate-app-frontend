import type { ReactNode } from 'react';

import { Sidebar } from '@/components/admin/Sidebar';
import { Topbar } from '@/components/admin/Topbar';

/**
 * `app/(admin)/admin/layout` — admin-zone shell.
 *
 * Structure (spec A2):
 * - Outer flex row pinned to the viewport (`h-screen`).
 *   - Sidebar on the left (w-64, dark `bg-neutral-900`, spec A7).
 *   - Right column holds the sticky Topbar and the scrollable content
 *     area. The inner `overflow-y-auto` on `<main>` is what makes the
 *     sidebar + topbar stay in place while the page content scrolls —
 *     the standard admin-dashboard pattern.
 *
 * Both the Sidebar and the Topbar are Server Components, so this layout
 * stays on the server (spec A1) and ships zero JS for the chrome.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
